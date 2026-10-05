<?php
namespace App\Infrastructure\Identity;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

final class Role extends Model
{
 protected $primaryKey='slug';
 public $incrementing=false;
 protected $keyType='string';
 protected $fillable=['slug','name','system'];

 public function permissions(): BelongsToMany
 {
  return $this->belongsToMany(Permission::class,'role_permissions','role_slug','permission_slug');
 }
}
