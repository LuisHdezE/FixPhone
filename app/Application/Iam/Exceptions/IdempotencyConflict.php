<?php
namespace App\Application\Iam\Exceptions;

use RuntimeException;

final class IdempotencyConflict extends RuntimeException {}
