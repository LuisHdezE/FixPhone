<?php

namespace App\Infrastructure\Storefront;

interface MercadoPagoGateway
{
    public function createPreference(array $payload): array;

    public function findPreferenceByExternalReference(string $externalReference): ?array;

    public function getPayment(string $paymentId): array;

    public function getMerchantOrder(string $merchantOrderId): array;

    public function findMerchantOrderByExternalReference(string $externalReference): ?array;

    public function findMerchantOrderForPayment(string $externalReference, string $paymentId): ?array;

    public function getChargeback(string $chargebackId): array;
}
