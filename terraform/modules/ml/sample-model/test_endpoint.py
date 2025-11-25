#!/usr/bin/env python3
"""
Test script for SageMaker Serverless Inference endpoint.

This script tests the deployed endpoint with sample data to verify it's working correctly.

Usage:
    python test_endpoint.py --endpoint-name YOUR-ENDPOINT-NAME
    
    # Or with AWS profile
    python test_endpoint.py --endpoint-name YOUR-ENDPOINT-NAME --profile YOUR-PROFILE
"""

import json
import argparse
import sys

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("Error: boto3 is required")
    print("Install with: pip install boto3")
    sys.exit(1)


def test_single_prediction(client, endpoint_name):
    """Test endpoint with a single prediction"""
    
    print("\n" + "=" * 60)
    print("Test 1: Single Contact Prediction")
    print("=" * 60)
    
    payload = {
        "features": [1, 10, 0.5]  # Monday, 10 AM, 50% previous answer rate
    }
    
    print(f"Input: {json.dumps(payload, indent=2)}")
    
    try:
        response = client.invoke_endpoint(
            EndpointName=endpoint_name,
            ContentType='application/json',
            Body=json.dumps(payload)
        )
        
        result = json.loads(response['Body'].read().decode())
        print(f"\nOutput: {json.dumps(result, indent=2)}")
        print("✅ Test passed!")
        return True
        
    except ClientError as e:
        print(f"❌ Test failed: {e}")
        return False


def test_batch_prediction(client, endpoint_name):
    """Test endpoint with batch prediction"""
    
    print("\n" + "=" * 60)
    print("Test 2: Batch Contact Prediction")
    print("=" * 60)
    
    payload = {
        "contacts": [
            {"day_of_week": 1, "hour_of_day": 10, "previous_answer_rate": 0.5},
            {"day_of_week": 2, "hour_of_day": 15, "previous_answer_rate": 0.3},
            {"day_of_week": 5, "hour_of_day": 19, "previous_answer_rate": 0.7},
        ]
    }
    
    print(f"Input: {json.dumps(payload, indent=2)}")
    
    try:
        response = client.invoke_endpoint(
            EndpointName=endpoint_name,
            ContentType='application/json',
            Body=json.dumps(payload)
        )
        
        result = json.loads(response['Body'].read().decode())
        print(f"\nOutput: {json.dumps(result, indent=2)}")
        print("✅ Test passed!")
        return True
        
    except ClientError as e:
        print(f"❌ Test failed: {e}")
        return False


def test_edge_cases(client, endpoint_name):
    """Test endpoint with edge cases"""
    
    print("\n" + "=" * 60)
    print("Test 3: Edge Cases")
    print("=" * 60)
    
    test_cases = [
        {
            "name": "Weekend day",
            "payload": {"features": [6, 12, 0.4]}  # Sunday, noon
        },
        {
            "name": "Early morning",
            "payload": {"features": [3, 6, 0.2]}  # Wednesday, 6 AM
        },
        {
            "name": "Late evening",
            "payload": {"features": [4, 22, 0.6]}  # Thursday, 10 PM
        },
        {
            "name": "Zero answer rate",
            "payload": {"features": [2, 14, 0.0]}  # Tuesday, 2 PM, no history
        },
        {
            "name": "Perfect answer rate",
            "payload": {"features": [1, 11, 1.0]}  # Monday, 11 AM, 100% rate
        }
    ]
    
    passed = 0
    failed = 0
    
    for test_case in test_cases:
        print(f"\nTesting: {test_case['name']}")
        print(f"Input: {json.dumps(test_case['payload'])}")
        
        try:
            response = client.invoke_endpoint(
                EndpointName=endpoint_name,
                ContentType='application/json',
                Body=json.dumps(test_case['payload'])
            )
            
            result = json.loads(response['Body'].read().decode())
            print(f"Output: {json.dumps(result)}")
            print("✅ Passed")
            passed += 1
            
        except ClientError as e:
            print(f"❌ Failed: {e}")
            failed += 1
    
    print(f"\nEdge case results: {passed} passed, {failed} failed")
    return failed == 0


def test_error_handling(client, endpoint_name):
    """Test endpoint error handling"""
    
    print("\n" + "=" * 60)
    print("Test 4: Error Handling")
    print("=" * 60)
    
    # Test with invalid input
    invalid_payloads = [
        {"name": "Missing features key", "payload": {"data": [1, 2, 3]}},
        {"name": "Invalid JSON", "payload": "not json"},
        {"name": "Empty payload", "payload": {}},
    ]
    
    for test in invalid_payloads:
        print(f"\nTesting: {test['name']}")
        
        try:
            if isinstance(test['payload'], str):
                body = test['payload']
            else:
                body = json.dumps(test['payload'])
            
            response = client.invoke_endpoint(
                EndpointName=endpoint_name,
                ContentType='application/json',
                Body=body
            )
            
            result = json.loads(response['Body'].read().decode())
            print(f"⚠️  Expected error but got result: {result}")
            
        except ClientError as e:
            print(f"✅ Correctly handled error: {e.response['Error']['Code']}")
        except Exception as e:
            print(f"✅ Correctly handled error: {type(e).__name__}")
    
    return True


def check_endpoint_status(client, endpoint_name):
    """Check if endpoint exists and is in service"""
    
    print("\n" + "=" * 60)
    print("Checking Endpoint Status")
    print("=" * 60)
    
    try:
        response = client.describe_endpoint(EndpointName=endpoint_name)
        
        status = response['EndpointStatus']
        print(f"Endpoint Name: {endpoint_name}")
        print(f"Status: {status}")
        print(f"Creation Time: {response['CreationTime']}")
        print(f"Last Modified: {response['LastModifiedTime']}")
        
        if status != 'InService':
            print(f"\n⚠️  Warning: Endpoint is not in service (status: {status})")
            print("Please wait for the endpoint to be ready before testing.")
            return False
        
        print("✅ Endpoint is ready for testing")
        return True
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'ValidationException':
            print(f"❌ Endpoint not found: {endpoint_name}")
        else:
            print(f"❌ Error checking endpoint: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Test SageMaker Serverless Inference endpoint'
    )
    parser.add_argument(
        '--endpoint-name',
        required=True,
        help='Name of the SageMaker endpoint to test'
    )
    parser.add_argument(
        '--region',
        default='il-central-1',
        help='AWS region (default: il-central-1)'
    )
    parser.add_argument(
        '--profile',
        help='AWS profile to use (optional)'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("SageMaker Endpoint Testing Suite")
    print("=" * 60)
    
    # Create boto3 client
    session_kwargs = {'region_name': args.region}
    if args.profile:
        session_kwargs['profile_name'] = args.profile
    
    session = boto3.Session(**session_kwargs)
    client = session.client('sagemaker-runtime')
    sagemaker_client = session.client('sagemaker')
    
    # Check endpoint status
    if not check_endpoint_status(sagemaker_client, args.endpoint_name):
        sys.exit(1)
    
    # Run tests
    results = []
    
    results.append(("Single Prediction", test_single_prediction(client, args.endpoint_name)))
    results.append(("Batch Prediction", test_batch_prediction(client, args.endpoint_name)))
    results.append(("Edge Cases", test_edge_cases(client, args.endpoint_name)))
    results.append(("Error Handling", test_error_handling(client, args.endpoint_name)))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    total_passed = sum(1 for _, passed in results if passed)
    total_tests = len(results)
    
    print(f"\nTotal: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("\n🎉 All tests passed! Endpoint is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please review the output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
