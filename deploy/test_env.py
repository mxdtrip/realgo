"""Regression checks for credential migration and preflight failures."""

import importlib.util
import contextlib
import io
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("check_env", ROOT / "deploy/check-env.py")
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


def valid_env():
    return {
        "AUTH_JWT_SECRET": "fixture-jwt-key-with-at-least-32-bytes",
        "DB_PASSWORD": "fixture-db-password",
        "REDIS_PASSWORD": "fixture-redis-password",
        "FRP_VPS_HOST": "example.invalid", "FRP_TOKEN": "fixture-frp-token",
        "SMTP2GO_SMTP_USERNAME": "fixture-smtp-user",
        "SMTP2GO_SMTP_PASSWORD": "fixture-smtp-password",
        "MAIL_BASE_URL": "https://staging.realgo.dev",
    }


class DeploymentEnvTests(unittest.TestCase):
    def test_missing_required_inputs_report_names_without_values(self):
        env = valid_env()
        env.pop("DB_PASSWORD")
        errors = CHECK.input_errors("staging", env)
        self.assertEqual(errors, ["DB_PASSWORD must be set"])
        self.assertNotIn(env["SMTP2GO_SMTP_PASSWORD"], "\n".join(errors))

    def test_production_requires_vpn_and_staging_does_not(self):
        self.assertEqual(CHECK.input_errors("staging", valid_env()), [])
        self.assertEqual(CHECK.input_errors("production", valid_env()), ["VPN_SUB_URL must be set"])

    def test_partial_oauth_configuration_is_rejected(self):
        env = valid_env()
        env["GITHUB_CLIENT_ID"] = "fixture-public-id"
        self.assertIn("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set together",
                      CHECK.input_errors("staging", env))

    def test_short_jwt_and_admin_password_are_rejected(self):
        env = valid_env()
        env.update(AUTH_JWT_SECRET="short", GOADMIN_USERNAME="fixture-admin", GOADMIN_PASSWORD="short")
        self.assertEqual(len(CHECK.input_errors("staging", env)), 2)

    def test_origin_rejects_credentials_paths_and_malformed_port(self):
        for origin in ("http://staging.realgo.dev", "https://user:password@example.invalid",
                       "https://example.invalid/api", "https://example.invalid:invalid"):
            with self.subTest(origin=origin):
                env = valid_env()
                env["MAIL_BASE_URL"] = origin
                self.assertEqual(CHECK.input_errors("staging", env),
                                 ["MAIL_BASE_URL must be a public HTTPS origin"])

    def test_database_mismatch_does_not_print_either_password(self):
        running = dict(DB_USER="postgres", DB_NAME="realgo", DB_PASSWORD="old-fixture-password")
        configured = dict(running, DB_PASSWORD="new-fixture-password")
        errors = CHECK.database_errors(configured, running)
        self.assertEqual(len(errors), 1)
        self.assertIn("DB_PASSWORD differs", errors[0])
        self.assertNotIn(running["DB_PASSWORD"], errors[0])
        self.assertNotIn(configured["DB_PASSWORD"], errors[0])
        self.assertEqual(CHECK.database_errors(running, running), [])

    def test_running_container_mismatch_is_checked_before_deploy(self):
        config = {"name": "realgo-staging", "services": {"api": {"environment": {
            "DB_USER": "postgres", "DB_NAME": "realgo", "DB_PASSWORD": "new-fixture",
        }}}}
        container = [{"Config": {"Env": ["DB_USER=postgres", "DB_NAME=realgo", "DB_PASSWORD=old-fixture"]}}]
        with patch.object(CHECK, "command_json", side_effect=[config, container]), \
                patch.object(CHECK.subprocess, "check_output", return_value="fixture-container\n"):
            errors = CHECK.check_running_database("staging")
        self.assertEqual(len(errors), 1)
        self.assertIn("DB_PASSWORD differs", errors[0])

    def test_docker_failure_does_not_leak_exception_details(self):
        output = io.StringIO()
        with patch.object(CHECK.sys, "argv", ["check-env.py", "staging"]), \
                patch.dict(CHECK.os.environ, valid_env(), clear=True), \
                patch.object(CHECK, "check_running_database", side_effect=ValueError("fixture-sensitive-value")), \
                contextlib.redirect_stderr(output):
            self.assertTrue(CHECK.main())
        self.assertNotIn("fixture-sensitive-value", output.getvalue())
        self.assertIn("Could not validate", output.getvalue())

    def test_github_overrides_runner_and_missing_optional_input_preserves_it(self):
        # Stub only preflight; exercise the sourced shell with quoting-sensitive
        # fixtures without exposing credentials in stdout.
        script = '''
python3() { return 0; }
source deploy/prepare-env.sh staging
[[ "$GOADMIN_PASSWORD" == "$EXPECTED_PASSWORD" ]]
[[ "$DB_PASSWORD" == "$EXPECTED_DB_PASSWORD" ]]
[[ "$MAIL_ENABLED" == "false" ]]
[[ ! ${DEPLOY_DB_PASSWORD+x} ]]
'''
        env = dict(os.environ, GOADMIN_PASSWORD="fixture runner $value 'quoted'",
                   DEPLOY_GOADMIN_PASSWORD="", EXPECTED_PASSWORD="fixture runner $value 'quoted'",
                   DB_PASSWORD="old fixture", DEPLOY_DB_PASSWORD="new fixture $value 'quoted'",
                   EXPECTED_DB_PASSWORD="new fixture $value 'quoted'",
                   MAIL_ENABLED="true", DEPLOY_MAIL_ENABLED="false")
        env.pop("GITHUB_ENV", None)
        result = subprocess.run(["bash", "-euc", script], cwd=ROOT, env=env,
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")

    def test_failed_preflight_stops_the_build_shell(self):
        result = subprocess.run(["bash", "-ec", '''
python3() { return 1; }
source deploy/prepare-env.sh staging
printf 'deployment must not start'
'''], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
