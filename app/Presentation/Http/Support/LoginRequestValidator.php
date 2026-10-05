<?php
namespace App\Presentation\Http\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

final class LoginRequestValidator
{
 public function validate(Request $request): array
 {
  return Validator::make($request->all(),[
   'email'=>['required','string','email','max:255'],
   'password'=>['required','string','max:255'],
   'device_name'=>['sometimes','string','max:100'],
  ],[
   'email.required'=>'El correo electrónico es obligatorio.',
   'email.email'=>'El correo electrónico no tiene un formato válido.',
   'password.required'=>'La contraseña es obligatoria.',
   'device_name.max'=>'El nombre del dispositivo no puede superar 100 caracteres.',
  ])->validate();
 }
}
