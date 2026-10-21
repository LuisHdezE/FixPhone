<?php

namespace App\Presentation\Http\Controllers\Storefront;

use App\Infrastructure\Storefront\MercadoPagoNotificationInbox;
use App\Infrastructure\Storefront\MercadoPagoWebhookSignature;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

final class StorefrontMercadoPagoWebhookController
{
    private const TOPICS = [
        'payment' => 'payment',
        'payments' => 'payment',
        'merchant_order' => 'merchant_order',
        'topic_merchant_order_wh' => 'merchant_order',
        'chargebacks' => 'chargeback',
        'topic_chargebacks_wh' => 'chargeback',
    ];

    public function __invoke(
        Request $request,
        MercadoPagoWebhookSignature $signature,
        MercadoPagoNotificationInbox $inbox,
    ): JsonResponse {
        $queryDataId = $request->query('data.id') ?? $request->query('data_id');
        $bodyDataId = $request->input('data.id');
        $requestId = trim((string) $request->header('x-request-id'));
        $resourceId = trim((string) ($queryDataId ?? $bodyDataId ?? $request->input('id', '')));
        if ($requestId === '' || $resourceId === ''
            || ($queryDataId !== null && $bodyDataId !== null && (string) $queryDataId !== (string) $bodyDataId)
            || ! $signature->isValid($request, $resourceId)) {
            return response()->json(['received' => false], 401);
        }

        $rawTopic = strtolower(trim((string) ($request->input('type') ?? $request->query('type') ?? $request->query('topic', ''))));
        $topic = self::TOPICS[$rawTopic] ?? null;
        if ($topic === null) {
            return response()->json(['received' => true]);
        }

        if (($topic === 'payment' || $topic === 'merchant_order') && ! preg_match('/^[0-9]{1,40}$/', $resourceId)) {
            return response()->json(['received' => false], 400);
        }

        try {
            $inbox->store($request, $topic, $resourceId);
        } catch (Throwable $exception) {
            Log::warning('Mercado Pago notification could not be stored durably.', [
                'request_id' => $request->header('x-request-id'),
                'topic' => $topic,
                'exception' => get_class($exception),
            ]);

            return response()->json(['received' => false], 503);
        }

        return response()->json(['received' => true]);
    }
}
