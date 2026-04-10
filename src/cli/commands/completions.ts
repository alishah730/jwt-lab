/**
 * CLI command for generating shell completion scripts.
 */
import { Command } from "commander";

const BASH_COMPLETION = `
_jwt_completions() {
  local cur prev commands opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  commands="encode decode verify inspect keygen explain mcp completions help"
  opts="--help --version --fake-time --config --json"

  case "\${prev}" in
    jwt)
      COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
      return 0
      ;;
    encode)
      COMPREPLY=( $(compgen -W "--secret --key --alg --exp --json --help" -- "\${cur}") )
      return 0
      ;;
    decode)
      COMPREPLY=( $(compgen -W "--json --batch --help" -- "\${cur}") )
      return 0
      ;;
    verify)
      COMPREPLY=( $(compgen -W "--secret --key --jwks --oidc-discovery --alg --require --leeway --json --batch --help" -- "\${cur}") )
      return 0
      ;;
    inspect)
      COMPREPLY=( $(compgen -W "--secret --key --jwks --oidc-discovery --alg --json --table --batch --help" -- "\${cur}") )
      return 0
      ;;
    keygen)
      COMPREPLY=( $(compgen -W "--format --kid --json --help RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512" -- "\${cur}") )
      return 0
      ;;
    explain)
      COMPREPLY=( $(compgen -W "--json --help" -- "\${cur}") )
      return 0
      ;;
    mcp)
      COMPREPLY=( $(compgen -W "serve --help" -- "\${cur}") )
      return 0
      ;;
    serve)
      COMPREPLY=( $(compgen -W "--port --host --help" -- "\${cur}") )
      return 0
      ;;
    completions)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      return 0
      ;;
  esac

  if [[ "\${cur}" == -* ]]; then
    COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
    return 0
  fi

  COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
}

complete -F _jwt_completions jwt
`.trim();

const ZSH_COMPLETION = `
#compdef jwt

_jwt() {
  local -a commands
  commands=(
    'encode:Encode a JWT from a JSON payload or natural language'
    'decode:Decode a JWT without verifying its signature'
    'verify:Verify a JWT signature and validate its claims'
    'inspect:Inspect a JWT — show status, metadata, and security posture'
    'keygen:Generate a cryptographic key pair for JWT signing'
    'explain:Static security audit of a JWT'
    'mcp:Model Context Protocol server for AI agents'
    'completions:Generate shell completion scripts'
    'help:Display help for command'
  )

  _arguments -C \\
    '(-v --version)'{-v,--version}'[output the version number]' \\
    '--fake-time[override system clock]:iso8601 date:' \\
    '--config[path to config file]:file:_files' \\
    '--json[output machine-readable JSON]' \\
    '(-h --help)'{-h,--help}'[display help for command]' \\
    '1:command:->cmd' \\
    '*::arg:->args'

  case "\$state" in
    cmd)
      _describe -t commands 'jwt command' commands
      ;;
    args)
      case "\$words[1]" in
        encode)
          _arguments \\
            '--secret[HMAC secret]:secret:' \\
            '--key[path to key file]:file:_files' \\
            '--alg[algorithm]:algorithm:(HS256 HS384 HS512 RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512)' \\
            '--exp[expiration time]:duration:' \\
            '--json[output JSON]' \\
            '1:payload:'
          ;;
        decode)
          _arguments \\
            '--json[output JSON]' \\
            '--batch[read tokens from stdin]' \\
            '1:token:'
          ;;
        verify)
          _arguments \\
            '--secret[HMAC secret]:secret:' \\
            '--key[path to key file]:file:_files' \\
            '--jwks[JWKS endpoint URL]:url:' \\
            '--oidc-discovery[OpenID Connect discovery URL]:url:' \\
            '--alg[expected algorithm]:algorithm:(HS256 HS384 HS512 RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512)' \\
            '--require[required claims]:claims:' \\
            '--leeway[clock skew tolerance]:seconds:' \\
            '--json[output JSON]' \\
            '--batch[read tokens from stdin]' \\
            '1:token:'
          ;;
        inspect)
          _arguments \\
            '--secret[HMAC secret]:secret:' \\
            '--key[path to key file]:file:_files' \\
            '--jwks[JWKS endpoint URL]:url:' \\
            '--oidc-discovery[OpenID Connect discovery URL]:url:' \\
            '--alg[expected algorithm]:algorithm:(HS256 HS384 HS512 RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512)' \\
            '--json[output JSON]' \\
            '--table[output as table]' \\
            '--batch[read tokens from stdin]' \\
            '1:token:'
          ;;
        keygen)
          _arguments \\
            '--format[key format]:format:(pem jwk)' \\
            '--kid[key ID]:kid:' \\
            '--json[output JSON]' \\
            '1:type:(RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512)'
          ;;
        explain)
          _arguments \\
            '--json[output JSON]' \\
            '1:token:'
          ;;
        mcp)
          local -a mcp_commands
          mcp_commands=('serve:Start the MCP HTTP/JSON server')
          _describe -t mcp_commands 'mcp command' mcp_commands
          ;;
        completions)
          _arguments '1:shell:(bash zsh fish)'
          ;;
      esac
      ;;
  esac
}

# Register the completion function with Zsh
compdef _jwt jwt
`.trim();

const FISH_COMPLETION = `
# jwt completions for fish shell
complete -c jwt -f

# Main commands
complete -c jwt -n '__fish_use_subcommand' -a encode -d 'Encode a JWT from a JSON payload'
complete -c jwt -n '__fish_use_subcommand' -a decode -d 'Decode a JWT without verification'
complete -c jwt -n '__fish_use_subcommand' -a verify -d 'Verify a JWT signature'
complete -c jwt -n '__fish_use_subcommand' -a inspect -d 'Inspect a JWT token'
complete -c jwt -n '__fish_use_subcommand' -a keygen -d 'Generate key pair for JWT signing'
complete -c jwt -n '__fish_use_subcommand' -a explain -d 'Static security audit of a JWT'
complete -c jwt -n '__fish_use_subcommand' -a mcp -d 'Model Context Protocol server'
complete -c jwt -n '__fish_use_subcommand' -a completions -d 'Generate shell completion scripts'
complete -c jwt -n '__fish_use_subcommand' -a help -d 'Display help'

# Global options
complete -c jwt -l version -s v -d 'Output version number'
complete -c jwt -l fake-time -x -d 'Override system clock'
complete -c jwt -l config -r -F -d 'Path to config file'
complete -c jwt -l json -d 'Output JSON'
complete -c jwt -l help -s h -d 'Display help'

# encode options
complete -c jwt -n '__fish_seen_subcommand_from encode' -l secret -x -d 'HMAC secret'
complete -c jwt -n '__fish_seen_subcommand_from encode' -l key -r -F -d 'Path to key file'
complete -c jwt -n '__fish_seen_subcommand_from encode' -l alg -x -a 'HS256 HS384 HS512 RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512' -d 'Algorithm'
complete -c jwt -n '__fish_seen_subcommand_from encode' -l exp -x -d 'Expiration time'

# decode options
complete -c jwt -n '__fish_seen_subcommand_from decode' -l batch -d 'Read tokens from stdin'

# verify options
complete -c jwt -n '__fish_seen_subcommand_from verify' -l secret -x -d 'HMAC secret'
complete -c jwt -n '__fish_seen_subcommand_from verify' -l key -r -F -d 'Path to key file'
complete -c jwt -n '__fish_seen_subcommand_from verify' -l jwks -x -d 'JWKS endpoint URL'
complete -c jwt -n '__fish_seen_subcommand_from verify' -l oidc-discovery -x -d 'OpenID Connect discovery URL'
complete -c jwt -n '__fish_seen_subcommand_from verify' -l alg -x -a 'HS256 HS384 HS512 RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512' -d 'Algorithm'
complete -c jwt -n '__fish_seen_subcommand_from verify' -l require -x -d 'Required claims'
complete -c jwt -n '__fish_seen_subcommand_from verify' -l leeway -x -d 'Clock skew tolerance'
complete -c jwt -n '__fish_seen_subcommand_from verify' -l batch -d 'Read tokens from stdin'

# inspect options
complete -c jwt -n '__fish_seen_subcommand_from inspect' -l secret -x -d 'HMAC secret'
complete -c jwt -n '__fish_seen_subcommand_from inspect' -l key -r -F -d 'Path to key file'
complete -c jwt -n '__fish_seen_subcommand_from inspect' -l jwks -x -d 'JWKS endpoint URL'
complete -c jwt -n '__fish_seen_subcommand_from inspect' -l oidc-discovery -x -d 'OpenID Connect discovery URL'
complete -c jwt -n '__fish_seen_subcommand_from inspect' -l alg -x -a 'HS256 HS384 HS512 RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512' -d 'Algorithm'
complete -c jwt -n '__fish_seen_subcommand_from inspect' -l table -d 'Output as table'
complete -c jwt -n '__fish_seen_subcommand_from inspect' -l batch -d 'Read tokens from stdin'

# keygen options
complete -c jwt -n '__fish_seen_subcommand_from keygen' -l format -x -a 'pem jwk' -d 'Key format'
complete -c jwt -n '__fish_seen_subcommand_from keygen' -l kid -x -d 'Key ID'
complete -c jwt -n '__fish_seen_subcommand_from keygen' -a 'RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512' -d 'Algorithm type'

# mcp subcommands
complete -c jwt -n '__fish_seen_subcommand_from mcp' -a serve -d 'Start MCP server'
complete -c jwt -n '__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from serve' -l port -x -d 'Server port'
complete -c jwt -n '__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from serve' -l host -x -d 'Server host'

# completions subcommand
complete -c jwt -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish' -d 'Shell type'
`.trim();

/**
 * Builds and returns the `completions` subcommand.
 */
export function buildCompletionsCommand(): Command {
  return new Command("completions")
    .description("Generate shell completion scripts")
    .argument("<shell>", "shell type: bash, zsh, or fish")
    .addHelpText(
      "after",
      `
Examples:
  # Bash — add to ~/.bashrc
  eval "$(jwt completions bash)"

  # Zsh — add to ~/.zshrc (must come AFTER compinit)
  autoload -Uz compinit && compinit
  eval "$(jwt completions zsh)"

  # Zsh — or save to fpath directory (preferred)
  jwt completions zsh > ~/.zsh/completions/_jwt

  # Fish — save to completions directory
  jwt completions fish > ~/.config/fish/completions/jwt.fish`,
    )
    .action((shell: string) => {
      switch (shell) {
        case "bash":
          console.log(BASH_COMPLETION);
          break;
        case "zsh":
          console.log(ZSH_COMPLETION);
          break;
        case "fish":
          console.log(FISH_COMPLETION);
          break;
        default:
          console.error(
            `Unknown shell: ${shell}. Supported: bash, zsh, fish`,
          );
          process.exit(1);
      }
    });
}
