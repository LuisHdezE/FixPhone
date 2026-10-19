<?php

namespace App\Infrastructure\Storefront;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class MercadoPagoApiClient
{
    public function createPreference(array $payload): array
    {
        return $this->request()->post('/checkout/preferences', $payload)->throw()->json();
    }

    public function searchPreferences(string $externalReference): array
    {
        return $this->request()
            ->get('/checkout/preferences/search', ['external_reference' => $externalReference, 'limit' => 10])
            ->throw()
            ->json();
    }

    public function getPayment(string $paymentId): array
    {
        return $this->request()->get('/v1/payments/'.rawurlencode($paymentId))->throw()->json();
    }

    private function request()
    {
        $token = (string) config('mercadopago.access_token');
        if ($token === '') {
            throw new RuntimeException('Mercado Pago no está configurado.');
        }

        $request = Http::baseUrl((string) config('mercadopago.api_url'))
            ->acceptJson()
            ->asJson()
            ->withToken($token)
            ->connectTimeout(3)
            ->timeout((int) config('mercadopago.request_timeout_seconds', 8));

        $integratorId = trim((string) config('mercadopago.integrator_id', ''));
        if ($integratorId !== '') {
            $request = $request->withHeaders(['x-integrator-id' => $integratorId]);
        }

        return $request;
    }
}
