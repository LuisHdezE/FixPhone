<?php

namespace App\Infrastructure\Media;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/**
 * Minimal S3 Signature V4 presigner for Cloudflare R2 (region auto).
 * No SDK dependency. Only pre-signed object URLs; no arbitrary hosts.
 * Secrets never leave the backend and are never logged.
 */
final class R2Presigner
{
    public function signedUrl(
        string $endpoint,
        string $bucket,
        string $key,
        string $accessId,
        string $secret,
        string $method,
        int $expiresSeconds = 180,
        ?string $contentType = null,
        ?DateTimeImmutable $time = null,
    ): string {
        if (!in_array($method, ['PUT', 'HEAD', 'DELETE'], true) ||
            $expiresSeconds < 1 || $expiresSeconds > 600) {
            throw new InvalidArgumentException('Método o vigencia de firma no permitido.');
        }
        $host = parse_url($endpoint, PHP_URL_HOST);
        if (!is_string($host) || !preg_match('/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/D', $host)) {
            throw new InvalidArgumentException('Endpoint R2 inválido.');
        }

        $time ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $time = $time->setTimezone(new DateTimeZone('UTC'));
        $amzDate = $time->format('Ymd\THis\Z');
        $date = $time->format('Ymd');
        $scope = $date.'/auto/s3/aws4_request';

        $canonicalUri = '/'.rawurlencode($bucket).'/'
            .implode('/', array_map('rawurlencode', explode('/', $key)));
        $signedHeaders = $contentType === null ? 'host' : 'content-type;host';
        $headers = $contentType === null
            ? 'host:'.$host."\n"
            : 'content-type:'.$contentType."\n".'host:'.$host."\n";

        $params = [
            'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential' => $accessId.'/'.$scope,
            'X-Amz-Date' => $amzDate,
            'X-Amz-Expires' => (string) $expiresSeconds,
            'X-Amz-SignedHeaders' => $signedHeaders,
        ];
        ksort($params, SORT_STRING);
        $query = implode('&', array_map(
            static fn (string $name, string $value): string =>
                rawurlencode($name).'='.rawurlencode($value),
            array_keys($params), array_values($params),
        ));

        $canonical = $method."\n".$canonicalUri."\n".$query."\n"
            .$headers."\n".$signedHeaders."\nUNSIGNED-PAYLOAD";
        $stringToSign = "AWS4-HMAC-SHA256\n".$amzDate."\n".$scope."\n"
            .hash('sha256', $canonical);

        $kDate = hash_hmac('sha256', $date, 'AWS4'.$secret, true);
        $kRegion = hash_hmac('sha256', 'auto', $kDate, true);
        $kService = hash_hmac('sha256', 's3', $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        return 'https://'.$host.$canonicalUri.'?'.$query.'&X-Amz-Signature='.$signature;
    }
}
