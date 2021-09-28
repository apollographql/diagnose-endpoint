# diagnose-endpoint

## Usage
```
npx diagnose-endpoint@1.0.12 --endpoint=https://endpoint-you-want-to-hit --origin=https://origin-of-page-that-makes-the-request
```

## Context
This package was created to help Apollo Studio users more definitively diagnose why their endpoint might not work with Studio's Explorer (in particular via Sandbox)

Browsers don't expose why a network request failed, so applications aren't able to tell whether a request failed because of missing CORS headers or if there's just nothing being served from the endpoint (server offline or typo in URL)

## Known limitations
Certain security software can cause browsers network requests to break in opaque ways that this script won't be able to diagnose
