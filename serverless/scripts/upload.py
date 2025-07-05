import boto3
import os
from pathlib import Path

def upload_to_r2(file_data: bytes, key: str, bucket_name: str) -> bool:
    """
    Upload bytes to Cloudflare R2 bucket
    
    Args:
        file_data: Binary data to upload
        key: Object key/path in the bucket
        bucket_name: R2 bucket name
        
    Returns:
        bool: True if upload successful, False otherwise
    """
    
    # R2 credentials from environment variables
    account_id = os.getenv('CLOUDFLARE_ACCOUNT_ID')
    access_key = os.getenv('CLOUDFLARE_ACCESS_KEY_ID')
    secret_key = os.getenv('CLOUDFLARE_SECRET_ACCESS_KEY')
    
    if not all([account_id, access_key, secret_key]):
        print("Missing required environment variables:")
        print("CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY")
        return False
    
    # R2 endpoint URL
    endpoint_url = f'https://{account_id}.r2.cloudflarestorage.com'
    
    # Create S3 client configured for R2
    s3_client = boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name='auto'
    )
    
    try:
        # Upload the bytes
        s3_client.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=file_data
        )
        print(f"Successfully uploaded {len(file_data)} bytes to {bucket_name}/{key}")
        return True
        
    except Exception as e:
        print(f"Upload failed: {e}")
        return False

def main():
    # Example usage
    sample_data = b"Hello, Cloudflare R2!"
    bucket_name = "your-r2-bucket-name"
    key = "test-file.txt"
    
    success = upload_to_r2(sample_data, key, bucket_name)
    
    if success:
        print("Upload completed successfully")
    else:
        print("Upload failed")

if __name__ == "__main__":
    main()