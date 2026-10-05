<?php
namespace App\Infrastructure\Identity;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

final class User extends Authenticatable
{
 use HasApiTokens;

 public $incrementing = false;
 protected $keyType = 'string';

 protected $fillable = ['id','name','email','password','role','active'];
 protected $hidden = ['password'];
 protected $casts = ['active'=>'boolean'];
}
