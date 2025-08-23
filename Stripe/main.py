# main.py
import stripe
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# This is a test secret key. Replace with your own.
# It's recommended to load this from an environment variable.
# It should look something like this
# Load Stripe API key from environment variable to avoid embedding secrets in code.
# Set the environment variable STRIPE_SECRET_KEY locally or in your deployment.
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_REPLACE_ME")

app = FastAPI()

# Add CORS middleware to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.get("/")
def read_root():
    return {"Hello": "World"}

# ... (previous code)

@app.post("/create-payment-intent")
async def create_payment_intent(request: Request):
    try:
        # The request body should contain 'amount' and 'currency'
        data = await request.json()
        amount = data.get('amount')
        currency = data.get('currency')

        if amount is None or currency is None:
            return JSONResponse(status_code=400, content={"error": "Amount and currency are required."})

        # Create a PaymentIntent with the order amount and currency
        intent = stripe.PaymentIntent.create(
            amount=amount, # Amount in the smallest currency unit (e.g., cents)
            currency=currency,
            automatic_payment_methods={"enabled": True},
        )

        return JSONResponse({
            'clientSecret': intent.client_secret
        })

    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})