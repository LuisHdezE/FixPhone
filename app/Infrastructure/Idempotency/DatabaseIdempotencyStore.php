<?php
namespace App\Infrastructure\Idempotency;
use App\Application\Shared\Contracts\IdempotencyStore;
use Illuminate\Support\Facades\DB;
final class DatabaseIdempotencyStore implements IdempotencyStore {
 public function reserve(string $scope,string $key,string $requestHash): bool {
  try { DB::table('idempotency_records')->insert(['scope'=>$scope,'idempotency_key'=>$key,'request_hash'=>$requestHash,'state'=>'reserved','created_at'=>now(),'updated_at'=>now()]); return true; }
  catch (\Illuminate\Database\QueryException) { return false; }
 }
 public function complete(string $scope,string $key,int $status,array $response): void {
  DB::table('idempotency_records')->where(['scope'=>$scope,'idempotency_key'=>$key])->update(['state'=>'completed','response_status'=>$status,'response_body'=>json_encode($response,JSON_THROW_ON_ERROR),'updated_at'=>now()]);
 }
 public function get(string $scope,string $key): ?array {
  $row=DB::table('idempotency_records')->where(['scope'=>$scope,'idempotency_key'=>$key])->first(); return $row? (array)$row:null;
 }
}
