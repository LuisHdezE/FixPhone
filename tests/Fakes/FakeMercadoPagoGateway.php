<?php

namespace Tests\Fakes;

use App\Infrastructure\Storefront\MercadoPagoGateway;
use RuntimeException;
use Throwable;

final class FakeMercadoPagoGateway implements MercadoPagoGateway
{
    public ?array $preference = null;

    public ?array $foundPreference = null;

    public array $payments = [];

    public array $merchantOrders = [];

    public array $chargebacks = [];

    public array $createdPayloads = [];

    public ?Throwable $createException = null;

    public function createPreference(array $payload): array
    {
        $this->createdPayloads[] = $payload;

        if ($this->createException !== null) {
            throw $this->createException;
        }

        return $this->preference ?? throw new RuntimeException('No hay preferencia simulada.');
    }

    public function findPreferenceByExternalReference(string $externalReference): ?array
    {
        return $this->foundPreference;
    }

    public function getPayment(string $paymentId): array
    {
        return $this->payments[$paymentId] ?? throw new RuntimeException('No hay pago simulado.');
    }

    public function getMerchantOrder(string $merchantOrderId): array
    {
        return $this->merchantOrders[$merchantOrderId] ?? throw new RuntimeException('No hay orden comercial simulada.');
    }

    public function findMerchantOrderByExternalReference(string $externalReference): ?array
    {
        foreach ($this->merchantOrders as $order) {
            if (($order['external_reference'] ?? null) === $externalReference) {
                return $order;
            }
        }

        return null;
    }

    public function findMerchantOrderForPayment(string $externalReference, string $paymentId): ?array
    {
        foreach ($this->merchantOrders as $order) {
            $matches = collect($order['payments'] ?? [])->contains(
                static fn ($payment): bool => (string) data_get($payment, 'id', '') === $paymentId,
            );
            if (($order['external_reference'] ?? null) === $externalReference && $matches) {
                return $order;
            }
        }

        return null;
    }

    public function getChargeback(string $chargebackId): array
    {
        return $this->chargebacks[$chargebackId] ?? throw new RuntimeException('No hay contracargo simulado.');
    }
}
