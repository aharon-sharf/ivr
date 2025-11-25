#!/usr/bin/env python3
"""
Create a placeholder ML model for testing SageMaker Serverless Inference endpoint.

This script creates a simple scikit-learn model that predicts optimal call times
based on basic features. This is for testing infrastructure only - replace with
a real trained model for production use.

Usage:
    python create_placeholder_model.py
    
This will create model.tar.gz that can be uploaded to S3.
"""

import pickle
import tarfile
import os
from datetime import datetime

try:
    from sklearn.ensemble import RandomForestClassifier
    import numpy as np
except ImportError:
    print("Error: scikit-learn and numpy are required")
    print("Install with: pip install scikit-learn numpy")
    exit(1)


def create_placeholder_model():
    """Create a simple placeholder model for testing"""
    
    # Create a simple model that predicts optimal call time
    # Features: [day_of_week (0-6), hour_of_day (0-23), previous_answer_rate (0-1)]
    # Output: optimal_hour (0-23)
    
    print("Creating placeholder ML model...")
    
    # Generate synthetic training data
    np.random.seed(42)
    n_samples = 1000
    
    # Features: day_of_week, hour_of_day, previous_answer_rate
    X = np.random.rand(n_samples, 3)
    X[:, 0] = np.random.randint(0, 7, n_samples)  # day_of_week
    X[:, 1] = np.random.randint(0, 24, n_samples)  # hour_of_day
    X[:, 2] = np.random.rand(n_samples)  # previous_answer_rate
    
    # Target: optimal_hour (simplified logic for demo)
    # Higher answer rates in morning (9-11) and evening (18-20)
    y = np.where(
        (X[:, 1] >= 9) & (X[:, 1] <= 11),
        10,  # Morning optimal time
        np.where(
            (X[:, 1] >= 18) & (X[:, 1] <= 20),
            19,  # Evening optimal time
            14   # Default afternoon time
        )
    )
    
    # Train a simple Random Forest model
    model = RandomForestClassifier(n_estimators=10, random_state=42)
    model.fit(X, y)
    
    print(f"Model trained with {n_samples} samples")
    print(f"Model score: {model.score(X, y):.2f}")
    
    return model


def create_inference_script():
    """Create a custom inference script for SageMaker"""
    
    inference_code = '''import json
import pickle
import os
import numpy as np

def model_fn(model_dir):
    """Load the model from the model_dir"""
    model_path = os.path.join(model_dir, 'model.pkl')
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    return model

def input_fn(request_body, content_type='application/json'):
    """
    Parse input data.
    
    Expected input format:
    {
        "features": [day_of_week, hour_of_day, previous_answer_rate]
    }
    or
    {
        "contacts": [
            {"day_of_week": 1, "hour_of_day": 10, "previous_answer_rate": 0.5},
            {"day_of_week": 2, "hour_of_day": 15, "previous_answer_rate": 0.3}
        ]
    }
    """
    if content_type == 'application/json':
        input_data = json.loads(request_body)
        
        # Handle single feature array
        if 'features' in input_data:
            return np.array([input_data['features']])
        
        # Handle batch of contacts
        elif 'contacts' in input_data:
            features = []
            for contact in input_data['contacts']:
                features.append([
                    contact.get('day_of_week', 0),
                    contact.get('hour_of_day', 12),
                    contact.get('previous_answer_rate', 0.5)
                ])
            return np.array(features)
        
        else:
            raise ValueError("Input must contain 'features' or 'contacts' key")
    else:
        raise ValueError(f"Unsupported content type: {content_type}")

def predict_fn(input_data, model):
    """Make predictions"""
    predictions = model.predict(input_data)
    probabilities = model.predict_proba(input_data)
    
    return {
        'predictions': predictions,
        'probabilities': probabilities
    }

def output_fn(prediction, accept='application/json'):
    """
    Format output.
    
    Output format:
    {
        "optimal_hours": [10, 19, 14],
        "confidence": [0.85, 0.92, 0.67]
    }
    """
    if accept == 'application/json':
        predictions = prediction['predictions']
        probabilities = prediction['probabilities']
        
        # Get confidence as max probability for each prediction
        confidence = [float(max(probs)) for probs in probabilities]
        
        result = {
            'optimal_hours': predictions.tolist(),
            'confidence': confidence
        }
        
        return json.dumps(result), accept
    else:
        raise ValueError(f"Unsupported accept type: {accept}")
'''
    
    return inference_code


def create_requirements():
    """Create requirements.txt for the model"""
    requirements = """scikit-learn==1.2.2
numpy==1.24.3
"""
    return requirements


def package_model(model):
    """Package the model and inference code into a tar.gz file"""
    
    print("\nPackaging model artifact...")
    
    # Save model
    with open('model.pkl', 'wb') as f:
        pickle.dump(model, f)
    print("✓ Saved model.pkl")
    
    # Save inference script
    with open('inference.py', 'w') as f:
        f.write(create_inference_script())
    print("✓ Created inference.py")
    
    # Save requirements
    with open('requirements.txt', 'w') as f:
        f.write(create_requirements())
    print("✓ Created requirements.txt")
    
    # Create tar.gz
    with tarfile.open('model.tar.gz', 'w:gz') as tar:
        tar.add('model.pkl')
        tar.add('inference.py')
        tar.add('requirements.txt')
    print("✓ Created model.tar.gz")
    
    # Clean up temporary files
    os.remove('model.pkl')
    os.remove('inference.py')
    os.remove('requirements.txt')
    
    print("\n✅ Model artifact created successfully!")
    print("\nNext steps:")
    print("1. Upload to S3:")
    print("   aws s3 cp model.tar.gz s3://YOUR-BUCKET/models/optimal-call-time/model.tar.gz")
    print("\n2. Deploy infrastructure:")
    print("   cd ../../.. && terraform apply")
    print("\n3. Test the endpoint:")
    print("   aws sagemaker-runtime invoke-endpoint \\")
    print("     --endpoint-name YOUR-ENDPOINT-NAME \\")
    print("     --body '{\"features\": [1, 10, 0.5]}' \\")
    print("     --content-type application/json \\")
    print("     output.json")


def main():
    print("=" * 60)
    print("SageMaker Placeholder Model Generator")
    print("=" * 60)
    print(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Create and package model
    model = create_placeholder_model()
    package_model(model)
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
