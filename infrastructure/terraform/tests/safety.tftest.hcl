mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = { account_id = "111122223333" }
  }
}
variables {
  name             = "citypulse-test"
  region           = "ap-south-1"
  azs              = ["ap-south-1a", "ap-south-1b"]
  bucket_name      = "citypulse-test-not-deployed"
  postgres_version = "17.6"
  hostname         = "citypulse.example.org"
  certificate_arn  = "arn:aws:acm:ap-south-1:111122223333:certificate/00000000-0000-0000-0000-000000000000"
  oidc_issuer      = "https://identity.example.org"
  oidc_audience    = "citypulse-api"
  redis_auth_token = strrev(strrev("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"))
  images = {
    web = "111122223333.dkr.ecr.ap-south-1.amazonaws.com/web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    api = "111122223333.dkr.ecr.ap-south-1.amazonaws.com/api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    ai  = "111122223333.dkr.ecr.ap-south-1.amazonaws.com/ai@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
  secrets = {
    migration = [{ name = "MIGRATION_PASSWORD", valueFrom = "arn:aws:secretsmanager:ap-south-1:111122223333:secret:test-migration" }]
    web       = [{ name = "SESSION_ENCRYPTION_KEY", valueFrom = "arn:aws:secretsmanager:ap-south-1:111122223333:secret:test-web" }]
    api       = [{ name = "DATABASE_PASSWORD", valueFrom = "arn:aws:secretsmanager:ap-south-1:111122223333:secret:test-api" }]
    ai        = [{ name = "AI_SERVICE_TOKEN", valueFrom = "arn:aws:secretsmanager:ap-south-1:111122223333:secret:test-ai" }]
  }
}
run "safe_bootstrap_defaults" {
  command = plan
  assert {
    condition     = output.security_posture.encrypted && !output.security_posture.public && output.security_posture.redis_tls && output.security_posture.backups >= 14
    error_message = "Private encrypted data services and backups are required."
  }
  assert {
    condition     = alltrue([for count in values(output.desired_counts) : count == 0])
    error_message = "Service startup must require explicit operator activation after migrations."
  }
}
run "bounded_scale" {
  command = plan
  variables { start_services = true }
  assert {
    condition     = output.desired_counts.ai == 1 && output.desired_counts.api == 2 && output.desired_counts.web == 2
    error_message = "SQLite-backed AI must stay single-writer while web/API start with two tasks."
  }
}
