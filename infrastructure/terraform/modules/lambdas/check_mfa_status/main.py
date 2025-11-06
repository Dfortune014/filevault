import os
import boto3
import json

cognito = boto3.client("cognito-idp")
USER_POOL_ID = os.environ["USER_POOL_ID"]

def lambda_handler(event, context):
    """
    Check if a user has MFA enabled by checking their MFA devices.
    This endpoint is called by authenticated users to check their own MFA status.
    """
    print("DEBUG full event:", json.dumps(event, indent=2))

    # Extract user ID from JWT claims
    claims = {}
    if "requestContext" in event and "authorizer" in event["requestContext"]:
        auth_ctx = event["requestContext"]["authorizer"]
        if "jwt" in auth_ctx:
            claims = auth_ctx.get("jwt", {}).get("claims", {})
        elif "claims" in auth_ctx:
            claims = auth_ctx.get("claims", {})

    user_sub = claims.get("sub")
    user_email = claims.get("email")
    username = claims.get("cognito:username") or claims.get("username")
    
    print(f"DEBUG Claims: sub={user_sub}, email={user_email}, username={username}")
    print(f"DEBUG Full claims: {json.dumps(claims, indent=2)}")
    
    if not user_sub:
        print("ERROR: No user sub found in claims")
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "User identifier not found in token"})
        }

    try:
        # For Cognito admin API, try email first (most reliable), then username, then sub
        # The username in Cognito is typically the email address
        user_identifier = user_email or username or user_sub
        print(f"DEBUG Using user identifier: {user_identifier}")
        
        # Get user details to check MFA status
        user_response = cognito.admin_get_user(
            UserPoolId=USER_POOL_ID,
            Username=user_identifier
        )
        
        print(f"DEBUG Full user_response keys: {list(user_response.keys())}")
        print(f"DEBUG Full user_response: {json.dumps(user_response, indent=2, default=str)}")
        
        # Check MFA settings from user response
        user_mfa_settings = user_response.get("UserMFASettingList", [])
        preferred_mfa_setting = user_response.get("PreferredMfaSetting", "")
        mfa_options = user_response.get("MFAOptions", [])
        
        print(f"DEBUG UserMFASettingList: {user_mfa_settings}")
        print(f"DEBUG PreferredMfaSetting: {preferred_mfa_setting}")
        print(f"DEBUG MFAOptions: {mfa_options}")
        
        # User has MFA enabled if:
        # 1. SOFTWARE_TOKEN_MFA is in their MFA settings list, OR
        # 2. Preferred MFA setting is SOFTWARE_TOKEN_MFA
        # 3. MFAOptions contains software token option
        has_totp = (
            "SOFTWARE_TOKEN_MFA" in user_mfa_settings or
            preferred_mfa_setting == "SOFTWARE_TOKEN_MFA" or
            any(
                opt.get("DeliveryMedium") == "SOFTWARE_TOKEN" if isinstance(opt, dict) else False
                for opt in mfa_options
            )
        )
        is_enabled = has_totp
        
        print(f"DEBUG MFA status: user_mfa_settings={user_mfa_settings}, preferred_mfa={preferred_mfa_setting}, has_totp={has_totp}, enabled={is_enabled}")
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "mfaEnabled": is_enabled,
                "hasTotpDevice": has_totp,
                "preferredMfaSetting": preferred_mfa_setting,
                "mfaDevices": len(user_mfa_settings)
            })
        }

    except cognito.exceptions.UserNotFoundException:
        print(f"ERROR: User {user_identifier} not found")
        # Try with sub if email/username didn't work
        if user_identifier != user_sub and user_sub:
            print(f"DEBUG Retrying with sub: {user_sub}")
            try:
                user_response = cognito.admin_get_user(
                    UserPoolId=USER_POOL_ID,
                    Username=user_sub
                )
                user_mfa_settings = user_response.get("UserMFASettingList", [])
                preferred_mfa_setting = user_response.get("PreferredMfaSetting", "")
                has_totp = "SOFTWARE_TOKEN_MFA" in user_mfa_settings
                is_enabled = has_totp or preferred_mfa_setting == "SOFTWARE_TOKEN_MFA"
                
                return {
                    "statusCode": 200,
                    "body": json.dumps({
                        "mfaEnabled": is_enabled,
                        "hasTotpDevice": has_totp,
                        "preferredMfaSetting": preferred_mfa_setting,
                        "mfaDevices": len(user_mfa_settings)
                    })
                }
            except Exception as e2:
                print(f"ERROR retry with sub also failed: {str(e2)}")
        
        return {
            "statusCode": 404,
            "body": json.dumps({"error": "User not found"})
        }
    except Exception as e:
        print(f"ERROR checking MFA status: {str(e)}")
        import traceback
        print(f"ERROR traceback: {traceback.format_exc()}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Failed to check MFA status", "details": str(e)})
        }

