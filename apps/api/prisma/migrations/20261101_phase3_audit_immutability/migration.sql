-- Phase 3.1: Immutable Audit Logs, Admin Activities, and Contract Acceptances
-- Ensures ordinary users and administrators cannot update or delete historical audit or digital sign-off records

CREATE OR REPLACE FUNCTION prevent_audit_and_acceptance_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'TrustPay Enterprise Governance: Historical audit logs, admin activities, and contract acceptances are immutable and append-only.'
    USING ERRCODE = '23506';
END;
$$ LANGUAGE plpgsql;

-- Apply immutability trigger to audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_logs_immutable'
  ) THEN
    CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON "audit_logs"
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_and_acceptance_mutation();
  END IF;
END $$;

-- Apply immutability trigger to admin_activities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_admin_activities_immutable'
  ) THEN
    CREATE TRIGGER trg_admin_activities_immutable
    BEFORE UPDATE OR DELETE ON "admin_activities"
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_and_acceptance_mutation();
  END IF;
END $$;

-- Apply immutability trigger to contract_acceptances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contract_acceptances_immutable'
  ) THEN
    CREATE TRIGGER trg_contract_acceptances_immutable
    BEFORE UPDATE OR DELETE ON "contract_acceptances"
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_and_acceptance_mutation();
  END IF;
END $$;

