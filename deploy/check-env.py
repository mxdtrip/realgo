"""Validate deployment inputs before any running container is changed."""

import json
import os
import subprocess
import sys
from urllib.parse import urlsplit


def input_errors(mode, env):
    required = [
        "AUTH_JWT_SECRET", "DB_PASSWORD", "REDIS_PASSWORD", "FRP_VPS_HOST",
        "FRP_TOKEN", "SMTP2GO_SMTP_USERNAME", "SMTP2GO_SMTP_PASSWORD",
    ]
    if mode == "production":
        required.append("VPN_SUB_URL")
    errors = [f"{key} must be set" for key in required if not env.get(key)]
    if env.get("AUTH_JWT_SECRET") and len(env["AUTH_JWT_SECRET"].encode()) < 32:
        errors.append("AUTH_JWT_SECRET must contain at least 32 bytes")
    for first, second in [
        ("YANDEX_CLIENT_ID", "YANDEX_CLIENT_SECRET"),
        ("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"),
        ("GOADMIN_USERNAME", "GOADMIN_PASSWORD"),
    ]:
        if bool(env.get(first)) != bool(env.get(second)):
            errors.append(f"{first} and {second} must be set together")
    admin_password = env.get("GOADMIN_PASSWORD")
    if admin_password and not 12 <= len(admin_password.encode()) <= 72:
        errors.append("GOADMIN_PASSWORD must contain 12-72 bytes")
    try:
        origin = urlsplit(env.get("MAIL_BASE_URL", ""))
        if (origin.scheme != "https" or not origin.hostname or origin.username
                or origin.password or origin.path not in ("", "/")
                or origin.query or origin.fragment):
            errors.append("MAIL_BASE_URL must be a public HTTPS origin")
        origin.port  # Reject malformed ports without logging the URL.
    except ValueError:
        errors.append("MAIL_BASE_URL must be a public HTTPS origin")
    return errors


def database_errors(configured, running):
    # A new POSTGRES_PASSWORD does not change the password in an existing
    # volume. Stop before recreating API/migrate with incompatible credentials.
    return [
        f"{key} differs from the running API; migrate existing database settings first"
        for key in ("DB_USER", "DB_NAME", "DB_PASSWORD")
        if configured.get(key) != running.get(key)
    ]


def command_json(args):
    return json.loads(subprocess.check_output(args, stderr=subprocess.DEVNULL))


def check_running_database(mode):
    overlay = "prod" if mode == "production" else "staging"
    config = command_json([
        "docker", "compose", "--env-file", "/dev/null", "-f", "docker-compose.yml",
        "-f", f"docker-compose.{overlay}.yml", "--profile", "prod-demo",
        "config", "--format", "json",
    ])
    project = config["name"]
    ids = subprocess.check_output([
        "docker", "ps", "-q", "--filter", f"label=com.docker.compose.project={project}",
        "--filter", "label=com.docker.compose.service=api",
    ], stderr=subprocess.DEVNULL, text=True).split()
    errors = []
    for container in ids:
        inspected = command_json(["docker", "inspect", container])[0]
        running = dict(item.split("=", 1) for item in inspected["Config"]["Env"])
        errors.extend(database_errors(config["services"]["api"]["environment"], running))
    return errors


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("staging", "production"):
        print("Usage: check-env.py staging|production", file=sys.stderr)
        return 1
    mode = sys.argv[1]
    errors = input_errors(mode, os.environ)
    if not errors:
        try:
            errors = check_running_database(mode)
        except (subprocess.SubprocessError, OSError, ValueError, KeyError, TypeError):
            # Exception text may contain a credential from a configuration.
            errors = ["Could not validate Compose and the running database configuration"]
    for error in errors:
        print(f"Deployment preflight: {error}", file=sys.stderr)
    if not errors:
        print(f"Deployment preflight: {mode} configuration is valid")
    return bool(errors)


if __name__ == "__main__":
    sys.exit(main())
