# AWS deployment infrastructure

Status: provider-schema validated and mocked-plan tested; not applied to an AWS account. No paid cloud resources were provisioned. Files use Terraform's native JSON configuration syntax (`.tf.json`) for explicit machine-readable module boundaries. Terraform 1.17.1 and the committed AWS provider lock select the validation toolchain.

## Modules and boundaries

- `network`: VPC, two AZs, public ALB subnets, private workload/data subnets, per-AZ NAT and route tables.
- `workload-boundary`: separate ALB/web/API/AI security groups; only ALB accepts public ingress. Main traffic is ALB → web → API → AI. Data security groups allow only the appropriate workload. NAT egress is broad for dependency/IdP traffic; restrict it further with endpoints/proxy policy before higher-assurance deployments.
- `data`: encrypted Multi-AZ RDS PostgreSQL, TLS/authenticated Redis replica pair, versioned/private/TLS-only S3, encrypted EFS access point for AI state, backup settings and optional encrypted SQS/DLQ. PostGIS installation and DB roles require operator bootstrap. S3 and SQS are reserved infrastructure, not integrated upload/worker implementations.
- `compute`: private Fargate tasks, immutable image digests, Cloud Map DNS, TLS ALB with an existing validated ACM certificate, CloudWatch log group, circuit-breaker rollback, web/API CPU scaling (2–4), a single AI writer and an operator-only migration task. No public blockchain or test signer is deployed.

ECS service counts default to zero, so an operator must bootstrap roles, run migrations and provision an IdP before setting `start_services=true`. This does **not** make a Terraform apply free: RDS, NAT, ALB, Redis and storage incur charges even at zero ECS tasks.

## Credential and state prerequisites

An authorized operator needs a sandbox AWS account, budget approval, short-lived federated AWS credentials, a validated ACM certificate in the selected region, DNS control, real IdP configuration, private ECR image digests and separately created Secrets Manager values. Select an actually available PostgreSQL 17 minor with `aws rds describe-db-engine-versions`; the example is not a tested region deployment.

Create an encrypted, versioned, access-restricted S3 state bucket separately; require TLS and use `use_lockfile=true`. Supply backend configuration with an ignored file or approved CLI arguments. Never commit state, saved plans, real tfvars, secret values or credentials. The Redis AUTH input is sensitive but **is stored in Terraform state** by this provider. Restrict state and plan access accordingly. Runtime Secrets Manager ARNs are references only; this configuration does not manage secret values or rotate them automatically. Use individual string-secret ARNs (no JSON-key ARN suffixes) with AWS-managed Secrets Manager encryption, or add explicitly scoped KMS permissions for a customer-managed key.

```bash
terraform init -backend-config=state.backend.hcl
# Copy environment.tfvars.json.example to ignored environment.tfvars.json.
# Populate real references; supply Redis AUTH via a protected TF_VAR_redis_auth_token.
terraform validate
terraform plan -var-file=environment.tfvars.json -out=reviewed.tfplan
# Review plan, monthly costs, state and recovery procedures before a separately authorized apply.
```

Offline safety checks require downloads but no AWS credentials:

```bash
terraform init -backend=false -input=false -lockfile=readonly
terraform fmt -check -recursive
terraform validate
terraform test
```

Mocked plans check encrypted/private data, backup retention, zero startup defaults and bounded replica counts. They do not validate AWS quotas, IAM effective permissions, available engine versions, certificate ownership or actual service health.

## First deployment order

1. Review costs and initialize protected remote state. Populate real ECR digests and individual runtime/migration secret ARNs. Keep `start_services=false`.
2. After an approved apply, use a private operator connection and the RDS-managed master secret to enable PostGIS and create a restricted `citypulse_app` role plus a distinct migrator. Grant schema ownership/default DML privileges to the migrator/runtime as documented in the database role script. No production tenant/admin seed runs automatically.
3. Run the emitted `migration_task_definition` once using `aws ecs run-task` in the API security group/private subnets. It uses an isolated migrator secret and the API image's `io.citypulse.operations.Migrate` entry point. Wait for STOPPED and require container exit code 0; inspect redacted CloudWatch logs. Do not put migration passwords in CLI overrides. It runs Flyway only, with no HTTP server, local profile or synthetic seed.
4. Provision real tenant/admin membership and verify actual IdP claims; set session secrets and a `rediss://` session URL using the provisioned cache endpoint. Verify the session Redis database/namespace policy. API Redis uses TLS; RDS uses `sslmode=verify-full` and the committed **public** AWS CA bundle. Refresh the bundle through a reviewed update before CA expiry.
5. Set `start_services=true`, review/apply the change and point DNS to the emitted ALB DNS name. Prove HTTPS, login/MFA, private service reachability, readiness, tenant isolation and scenario persistence before traffic. AI uses stop-before-start deployment to avoid overlapping SQLite writers, with a deliberate availability gap.

Internal service traffic currently uses private HTTP; authenticated encryption between tasks (for example Service Connect TLS) is an explicit production security follow-up. Fargate roots are writable ephemeral filesystems because these images need scratch space; non-root users, capability drops and task isolation remain, but local read-only-root guarantees are not asserted for cloud tasks. Application metrics/OTLP cloud collector hosting is not yet deployed by these modules; CloudWatch captures ECS stdout and the ALB alarm requires real `alarm_actions` subscribers.

Managed-source references: [Fargate/EFS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/efs-volumes.html), [RDS PostGIS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.PostGIS.html), [Redis AUTH/TLS](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/auth.html), [ECS deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html).

See [deployment](../../docs/operations/deployment.md), [scaling/costs](../../docs/operations/scaling.md), and [recovery](../../docs/operations/recovery.md).
