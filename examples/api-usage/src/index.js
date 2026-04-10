import {
  inspectToken,
  
} from "jwt-lab";
const verifyResult = await inspectToken({
  token: "<paste_jwt_here>",
  oidcDiscoveryUrl: "https://issuer.example.com/.well-known/openid-configuration",
  // Omit alg so we accept whatever algorithm the provider uses (RS256, ES256, etc.)
  // Uncomment to pin to a specific algorithm:
  // alg: "RS256",
});

console.log(JSON.stringify(verifyResult ,null, 4));

// jwt verify "<paste_jwt_here>" --oidc-discovery "https://issuer.example.com/.well-known/openid-configuration"