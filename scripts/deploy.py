import os
import sys
import paramiko
import getpass

# --- Server Configuration (environment variables only) ---
# Required: DEPLOY_HOST, DEPLOY_USER
# Auth: DEPLOY_PASSWORD and/or DEPLOY_SSH_KEY_PATH
HOSTNAME = os.environ.get('DEPLOY_HOST')
PORT = int(os.environ.get('DEPLOY_PORT', '22'))
USERNAME = os.environ.get('DEPLOY_USER')
SSH_KEY_PATH = os.environ.get('DEPLOY_SSH_KEY_PATH')

# --- Project Configuration ---
LOCAL_DIRECTORY = os.environ.get('DEPLOY_LOCAL_DIR', 'dist')
REMOTE_DIRECTORY = os.environ.get('DEPLOY_REMOTE_DIR')

def upload_directory(sftp_client, local_path, remote_path):
    """
    Recursively uploads a directory and its contents to the remote server.
    """
    print(f"Creating remote directory: {remote_path}")
    try:
        sftp_client.mkdir(remote_path)
    except IOError:
        print(f"Directory {remote_path} already exists.")

    for item in os.listdir(local_path):
        local_item_path = os.path.join(local_path, item)
        remote_item_path = f"{remote_path}/{item}"

        if os.path.isfile(local_item_path):
            print(f"Uploading file: {local_item_path} -> {remote_item_path}")
            sftp_client.put(local_item_path, remote_item_path)
        elif os.path.isdir(local_item_path):
            upload_directory(sftp_client, local_item_path, remote_item_path)

def connect_transport():
    if not HOSTNAME or not USERNAME:
        print("Error: set DEPLOY_HOST and DEPLOY_USER before running deploy.")
        print("See docs/DEPLOY.md for required environment variables.")
        sys.exit(1)

    password = os.environ.get('DEPLOY_PASSWORD')
    if not password and not SSH_KEY_PATH and sys.stdin.isatty():
        password = getpass.getpass(f"Enter password for {USERNAME}@{HOSTNAME}: ")

    transport = paramiko.Transport((HOSTNAME, PORT))

    if SSH_KEY_PATH:
        pkey = paramiko.RSAKey.from_private_key_file(SSH_KEY_PATH)
        transport.connect(username=USERNAME, pkey=pkey)
    elif password:
        transport.connect(username=USERNAME, password=password)
    else:
        print("Error: provide DEPLOY_PASSWORD, DEPLOY_SSH_KEY_PATH, or run interactively.")
        sys.exit(1)

    return transport

def main():
    """
    Main function to connect to the server and start the upload process.
    """
    if not REMOTE_DIRECTORY:
        print("Error: set DEPLOY_REMOTE_DIR to the target path on the server.")
        print("See docs/DEPLOY.md for required environment variables.")
        sys.exit(1)

    transport = None
    sftp = None
    try:
        print("Connecting to server...")
        transport = connect_transport()
        print("Connection successful!")

        sftp = paramiko.SFTPClient.from_transport(transport)
        print(f"Starting upload of '{LOCAL_DIRECTORY}' to '{REMOTE_DIRECTORY}'...")

        upload_directory(sftp, LOCAL_DIRECTORY, REMOTE_DIRECTORY)

        print("\n✅ Deployment complete!")

    except Exception as e:
        print(f"❌ An error occurred: {e}")
        sys.exit(1)
    finally:
        if sftp:
            sftp.close()
        if transport:
            transport.close()
        print("Connection closed.")

if __name__ == "__main__":
    if not os.path.exists(LOCAL_DIRECTORY):
        print(f"Error: Local directory '{LOCAL_DIRECTORY}' not found. Did you run 'npm run build' first?")
        sys.exit(1)
    main()
