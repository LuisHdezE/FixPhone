<?php

namespace App\Infrastructure\Storefront;

use MercadoPago\Client\Chargeback\ChargebackClient;
use MercadoPago\Client\Common\RequestOptions;
use MercadoPago\Client\MerchantOrder\MerchantOrderClient;
use MercadoPago\Client\Payment\PaymentClient;
use MercadoPago\Client\Preference\PreferenceClient;
use MercadoPago\MercadoPagoConfig;
use MercadoPago\Net\MPResource;
use MercadoPago\Net\MPSearchRequest;
use RuntimeException;

final class MercadoPagoSdkGateway implements MercadoPagoGateway
{
    public function createPreference(array $payload): array
    {
        $this->configure();

        return $this->content((new PreferenceClient)->create($payload, $this->requestOptions(false)));
    }

    public function findPreferenceByExternalReference(string $externalReference): ?array
    {
        $this->configure();
        $search = (new PreferenceClient)->search(
            new MPSearchRequest(10, 0, ['external_reference' => $externalReference]),
            $this->requestOptions(),
        );

        foreach (($this->content($search)['elements'] ?? []) as $candidate) {
            if (($candidate['external_reference'] ?? null) !== $externalReference || empty($candidate['id'])) {
                continue;
            }

            return $this->content((new PreferenceClient)->get((string) $candidate['id'], $this->requestOptions()));
        }

        return null;
    }

    public function getPayment(string $paymentId): array
    {
        if (! preg_match('/^[0-9]{1,40}$/', $paymentId)) {
            throw new RuntimeException('Identificador de pago inválido.');
        }

        $this->configure();

        return $this->content((new PaymentClient)->get((int) $paymentId, $this->requestOptions()));
    }

    public function getMerchantOrder(string $merchantOrderId): array
    {
        if (! preg_match('/^[0-9]{1,40}$/', $merchantOrderId)) {
            throw new RuntimeException('Identificador de orden comercial inválido.');
        }

        $this->configure();

        return $this->content((new MerchantOrderClient)->get((int) $merchantOrderId, $this->requestOptions()));
    }

    public function findMerchantOrderForPayment(string $externalReference, string $paymentId): ?array
    {
        foreach ($this->searchMerchantOrders($externalReference) as $merchantOrder) {
            $containsPayment = collect($merchantOrder['payments'] ?? [])->contains(
                static fn (array $payment): bool => (string) ($payment['id'] ?? '') === $paymentId,
            );
            if (($merchantOrder['external_reference'] ?? null) === $externalReference && $containsPayment) {
                return ! empty($merchantOrder['id'])
                    ? $this->getMerchantOrder((string) $merchantOrder['id'])
                    : $merchantOrder;
            }
        }

        return null;
    }

    public function findMerchantOrderByExternalReference(string $externalReference): ?array
    {
        foreach ($this->searchMerchantOrders($externalReference) as $merchantOrder) {
            if (($merchantOrder['external_reference'] ?? null) === $externalReference) {
                return ! empty($merchantOrder['id'])
                    ? $this->getMerchantOrder((string) $merchantOrder['id'])
                    : $merchantOrder;
            }
        }

        return null;
    }

    public function getChargeback(string $chargebackId): array
    {
        $this->configure();

        return $this->content((new ChargebackClient)->get($chargebackId, $this->requestOptions()));
    }

    private function configure(): void
    {
        $token = trim((string) config('mercadopago.access_token'));
        if ($token === '') {
            throw new RuntimeException('Mercado Pago no está configurado.');
        }

        MercadoPagoConfig::setAccessToken($token);
        MercadoPagoConfig::setRuntimeEnviroment(MercadoPagoConfig::SERVER);
        MercadoPagoConfig::setConnectionTimeout((int) config('mercadopago.request_timeout_milliseconds', 8000));
        MercadoPagoConfig::setIntegratorId(trim((string) config('mercadopago.integrator_id', '')));
    }

    private function searchMerchantOrders(string $externalReference): array
    {
        $this->configure();
        $search = (new MerchantOrderClient)->search(
            new MPSearchRequest(20, 0, ['external_reference' => $externalReference]),
            $this->requestOptions(),
        );

        return $this->content($search)['elements'] ?? [];
    }

    private function requestOptions(bool $retryReads = true): RequestOptions
    {
        $options = new RequestOptions;
        $options->setConnectionTimeout((int) config('mercadopago.request_timeout_milliseconds', 8000));
        $options->setMaxRetries($retryReads ? 2 : 0);

        return $options;
    }

    private function content(MPResource $resource): array
    {
        $content = $resource->getResponse()->getContent();
        if (! is_array($content)) {
            throw new RuntimeException('Mercado Pago devolvió una respuesta inesperada.');
        }

        return $content;
    }
}
