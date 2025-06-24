#!/usr/bin/env python3
import environ
import subprocess
import os
import argparse


env = environ.Env()

def run_command(command: list):
    print(f"Running command: {' '.join(command)}")
    subprocess.run(command, check=True, capture_output=False)


def run_migrations():
    run_command([f"{os.path.curdir}/manage.py", 'migrate', '--noinput', '--no-color'])

def run_seed():
    import django
    django.setup()

    from ChainApp.utils.generate_data import initialize_text_studies
    initialize_text_studies()

def run_serve():
    gunicorn_workers = str((lambda c: c * 2 + 1 if c else 2)(os.cpu_count()))
    django_port = env.int('DJANGO_PORT') # type: ignore
    django_wsgi_application = str(env('DJANGO_WSGI_APPLICATION'))
    bind_address = f"0.0.0.0:{django_port}"

    os.execvp('gunicorn', [
        'gunicorn', django_wsgi_application,
        '--bind', bind_address,
        '--workers', gunicorn_workers
    ])

def run_shell():
    os.execvp('/bin/ash', ['/bin/ash'])

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Application entrypoint")
    parser.add_argument("command", choices=["migrate", "serve", "seed", "shell"])
    args = parser.parse_args()

    if args.command == "migrate":
        run_migrations()
    elif args.command == "seed":
        run_seed()
    elif args.command == "serve":
        run_serve()
    if args.command == "shell":
        run_shell()
