<?php

namespace Tests\Feature;

use Tests\TestCase;

final class FoundationHttpTest extends TestCase
{
    public function test_unknown_api_route_uses_problem_details_and_correlation_id(): void
    {
        $response = $this->withHeader('X-Correlation-ID', 'fixphone-test-correlation')
            ->getJson('/api/v1/does-not-exist');

        $response->assertStatus(404)
            ->assertHeader('content-type', 'application/problem+json')
            ->assertHeader('X-Correlation-ID', 'fixphone-test-correlation')
            ->assertJsonPath('status', 404)
            ->assertJsonPath('code', 'http_404')
            ->assertJsonPath('correlationId', 'fixphone-test-correlation');
    }
}
