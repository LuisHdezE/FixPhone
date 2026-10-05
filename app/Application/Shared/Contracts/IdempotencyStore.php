<?php
namespace App\Application\Shared\Contracts;
interface IdempotencyStore {
 public function reserve(string $scope,string $key,string $requestHash): bool;
 public function complete(string $scope,string $key,int $status,array $response): void;
 public function get(string $scope,string $key): ?array;
}
