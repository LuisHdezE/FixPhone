<?php
namespace App\Infrastructure\Identity;

use Illuminate\Database\Eloquent\Model;

final class Permission extends Model
{
 protected $primaryKey='slug';
 public $incrementing=false;
 protected $keyType='string';
 protected $fillable=['slug','name'];
}
