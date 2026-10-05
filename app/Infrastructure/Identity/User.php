<?php
namespace App\Infrastructure\Identity;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

final class User extends Authenticatable
{
 use HasApiTokens;

 public $incrementing=false;
 protected $keyType='string';
 protected $fillable=['id','name','email','password','active'];
 protected $hidden=['password'];
 protected $casts=['active'=>'boolean'];

 public function roles(): BelongsToMany
 {
  return $this->belongsToMany(Role::class,'user_roles','user_id','role_slug');
 }
}
