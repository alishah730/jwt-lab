import { Component, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { JwtService } from './jwt.service';

// A real-world OIDC token for demo purposes
const SAMPLE_TOKEN ='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30';

@Component({
  selector: 'app-root',
  imports: [FormsModule, JsonPipe],
  template: `
    <div class="container">
      <h1>🔬 jwt-lab — Angular Example</h1>
      <p class="subtitle">
        Demonstrates <code>jwt-lab</code> running in the browser via Angular.
        No Node.js <code>Buffer</code> needed — fully browser-compatible.
      </p>

      <!-- Token Input -->
      <section class="input-section">
        <label for="token">Paste a JWT token:</label>
        <textarea
          id="token"
          [(ngModel)]="tokenInput"
          rows="5"
          placeholder="eyJhbGciOiJSUzI1NiIs..."
          spellcheck="false"
        ></textarea>
        <div class="actions">
          <button (click)="loadSample()">Load Sample Token</button>
          <button (click)="tokenInput.set('')">Clear</button>
        </div>
      </section>

      <!-- Error -->
      @if (!isOk() && errorMessage()) {
        <section class="error">
          ❌ {{ errorMessage() }}
          <span class="code">[{{ errorCode() }}]</span>
        </section>
      }

      <!-- Decoded Output -->
      @if (isOk()) {
        <section class="results">
          <!-- Header -->
          <div class="card">
            <h2>📋 Header</h2>
            <pre>{{ header() | json }}</pre>
          </div>

          <!-- Payload -->
          <div class="card">
            <h2>📦 Payload</h2>
            <pre>{{ payload() | json }}</pre>
          </div>

          <!-- Token Info -->
          <div class="card">
            <h2>ℹ️ Token Info</h2>
            <table>
              <tr>
                <td>Algorithm</td>
                <td><code>{{ header()['alg'] }}</code></td>
              </tr>
              <tr>
                <td>Signature</td>
                <td>{{ signaturePresent() ? '✅ Present' : '⚠️ Missing' }}</td>
              </tr>
              <tr>
                <td>Subject</td>
                <td>{{ payload()['sub'] ?? '—' }}</td>
              </tr>
              <tr>
                <td>Issuer</td>
                <td>{{ payload()['iss'] ?? '—' }}</td>
              </tr>
              <tr>
                <td>Audience</td>
                <td>{{ payload()['aud'] ?? '—' }}</td>
              </tr>
              <tr>
                <td>Expiry</td>
                <td [class.expired]="isExpired()">{{ expiryInfo() }}</td>
              </tr>
            </table>
          </div>

          <!-- Lint Findings -->
          @if (lintFindings().length > 0) {
            <div class="card">
              <h2>🔍 Security Lint</h2>
              @for (finding of lintFindings(); track finding.ruleId) {
                <div class="finding" [class]="finding.severity">
                  <span class="badge">{{ finding.severity.toUpperCase() }}</span>
                  <strong>{{ finding.ruleId }}</strong>: {{ finding.description }}
                  <div class="fix">💡 {{ finding.suggestedFix }}</div>
                </div>
              }
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    :host { display: block; font-family: 'Segoe UI', system-ui, sans-serif; }
    .container { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    h1 { margin-bottom: 0.25rem; }
    .subtitle { color: #666; margin-bottom: 2rem; }
    .subtitle code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    label { font-weight: 600; display: block; margin-bottom: 0.5rem; }
    textarea {
      width: 100%; box-sizing: border-box; padding: 0.75rem; border: 2px solid #e0e0e0;
      border-radius: 8px; font-family: 'Fira Code', monospace; font-size: 0.85rem;
      resize: vertical; transition: border-color 0.2s;
    }
    textarea:focus { border-color: #4a90d9; outline: none; }
    .actions { margin-top: 0.5rem; display: flex; gap: 0.5rem; }
    button {
      padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer;
      font-weight: 600; transition: background 0.2s;
    }
    button:first-child { background: #4a90d9; color: white; }
    button:first-child:hover { background: #357abd; }
    button:last-child { background: #e0e0e0; }
    button:last-child:hover { background: #ccc; }
    .error {
      margin-top: 1rem; padding: 1rem; background: #fef2f2; border: 1px solid #fca5a5;
      border-radius: 8px; color: #b91c1c;
    }
    .code { font-family: monospace; font-size: 0.85em; opacity: 0.7; }
    .results { margin-top: 1.5rem; display: grid; gap: 1rem; }
    .card {
      background: white; border: 1px solid #e0e0e0; border-radius: 8px;
      padding: 1rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .card h2 { margin: 0 0 0.75rem; font-size: 1.1rem; }
    pre {
      background: #f8f8f8; padding: 1rem; border-radius: 6px; overflow-x: auto;
      font-size: 0.85rem; margin: 0; white-space: pre-wrap; word-break: break-all;
    }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 0.4rem 0; border-bottom: 1px solid #f0f0f0; }
    td:first-child { font-weight: 600; width: 120px; color: #555; }
    td code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
    .expired { color: #b91c1c; font-weight: 600; }
    .finding {
      margin-bottom: 0.75rem; padding: 0.75rem; border-radius: 6px;
      border-left: 4px solid #ccc;
    }
    .finding.error { background: #fef2f2; border-left-color: #ef4444; }
    .finding.warn { background: #fffbeb; border-left-color: #f59e0b; }
    .finding.info { background: #eff6ff; border-left-color: #3b82f6; }
    .badge {
      display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 0.7rem;
      font-weight: 700; margin-right: 0.5rem; color: white;
    }
    .error .badge { background: #ef4444; }
    .warn .badge { background: #f59e0b; }
    .info .badge { background: #3b82f6; }
    .fix { margin-top: 0.25rem; font-size: 0.85rem; color: #555; }
  `],
})
export class App {
  private jwt = inject(JwtService);

  protected tokenInput = signal(SAMPLE_TOKEN);

  protected isOk = computed(() => {
    const token = this.tokenInput().trim();
    if (!token) return false;
    return this.jwt.decode(token).ok;
  });

  protected errorMessage = computed(() => {
    const token = this.tokenInput().trim();
    if (!token) return '';
    const result = this.jwt.decode(token);
    return result.ok ? '' : result.error.message;
  });

  protected errorCode = computed(() => {
    const token = this.tokenInput().trim();
    if (!token) return '';
    const result = this.jwt.decode(token);
    return result.ok ? '' : result.error.code;
  });

  protected header = computed(() => this.jwt.extractHeader(this.tokenInput().trim()));

  protected payload = computed(() => this.jwt.extractPayload(this.tokenInput().trim()));

  protected signaturePresent = computed(() => {
    const token = this.tokenInput().trim();
    if (!token) return false;
    const result = this.jwt.decode(token);
    return result.ok ? result.value.signaturePresent : false;
  });

  protected isExpired = computed(() => {
    const token = this.tokenInput().trim();
    return token ? this.jwt.isExpired(token) : false;
  });

  protected expiryInfo = computed(() => {
    const token = this.tokenInput().trim();
    return token ? this.jwt.getExpiryInfo(token) : '';
  });

  protected lintFindings = computed(() => {
    const token = this.tokenInput().trim();
    return token ? this.jwt.lint(token) : [];
  });

  protected loadSample(): void {
    this.tokenInput.set(SAMPLE_TOKEN);
  }
}
