import { describe, it, expect } from 'vitest';
import { VariableManager } from './variable-manager.js';

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

describe('VariableManager key validation', () => {
  it('accepts valid flat keys', () => {
    const vm = new VariableManager();
    expect(() => vm.addVariable('port', { type: 'number' })).not.toThrow();
    expect(() => vm.addVariable('app_name', { type: 'string' })).not.toThrow();
    expect(() => vm.addVariable('a', { type: 'string' })).not.toThrow();
  });

  it('accepts keys with dots (cosmetic grouping)', () => {
    const vm = new VariableManager();
    expect(() => vm.addVariable('db.host', { type: 'string' })).not.toThrow();
    expect(() => vm.addVariable('app.db.port', { type: 'number' })).not.toThrow();
  });

  it('rejects keys starting with uppercase', () => {
    const vm = new VariableManager();
    expect(() => vm.addVariable('Port' as never, { type: 'number' })).toThrow();
  });

  it('rejects keys starting with a digit', () => {
    const vm = new VariableManager();
    expect(() => vm.addVariable('1port' as never, { type: 'number' })).toThrow();
  });

  it('rejects keys starting with underscore', () => {
    const vm = new VariableManager();
    expect(() => vm.addVariable('_port' as never, { type: 'number' })).toThrow();
  });

  it('rejects keys with uppercase letters', () => {
    const vm = new VariableManager();
    expect(() => vm.addVariable('appName' as never, { type: 'string' })).toThrow();
  });

  it('rejects empty string key', () => {
    const vm = new VariableManager();
    expect(() => vm.addVariable('' as never, { type: 'string' })).toThrow();
  });

  it('rejects keys with hyphens', () => {
    const vm = new VariableManager();
    expect(() => vm.addVariable('app-name' as never, { type: 'string' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

describe('VariableManager duplicate detection', () => {
  it('throws on duplicate variable key', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number' });
    expect(() => vm.addVariable('port' as never, { type: 'string' })).toThrow(/[Dd]uplicate/);
  });
});

// ---------------------------------------------------------------------------
// Builder pattern chaining
// ---------------------------------------------------------------------------

describe('VariableManager builder pattern', () => {
  it('chains addVariable calls and returns VariableManager', () => {
    const vm = new VariableManager()
      .addVariable('app_name', { type: 'string' })
      .addVariable('port', { type: 'number', default: 3000 })
      .addVariable('debug', { type: 'boolean' });

    const json = vm.toJSON();
    expect(json.variables).toHaveLength(3);
  });

  it('addConnector returns this for chaining', () => {
    class MockConnector {
      async load(_keys: string[]) {}
      get(_key: string): unknown {
        return undefined;
      }
    }

    const vm = new VariableManager()
      .addVariable('port', { type: 'number' })
      .addConnector('env', new MockConnector() as never);

    expect(vm).toBeInstanceOf(VariableManager);
  });
});

// ---------------------------------------------------------------------------
// $var
// ---------------------------------------------------------------------------

describe('$var()', () => {
  it('returns a string containing $${{key}} at runtime', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number' });
    const { $var } = vm.createRef();
    expect($var('port')).toBe('$${{port}}');
  });

  it('returns the correct tagged string for dotted keys', () => {
    const vm = new VariableManager().addVariable('db.host', { type: 'string' });
    const { $var } = vm.createRef();
    expect($var('db.host')).toBe('$${{db.host}}');
  });

  it('returns the same tag string with or without options', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number' });
    const { $var } = vm.createRef();
    expect($var('port')).toBe($var('port', { default: 3000 }));
  });

  it('throws for an unknown key', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number' });
    const { $var } = vm.createRef();
    expect(() => $var('unknown_key' as never)).toThrow(/[Uu]nknown/);
  });

  it('is assignable to string', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number' });
    const { $var } = vm.createRef();
    const ref = $var('port');
    const s: string = ref; // should compile without cast
    expect(typeof s).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Call-site default duplicate detection
// ---------------------------------------------------------------------------

describe('call-site default duplicate detection', () => {
  it('registers a call-site default the first time', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number' });
    const { $var } = vm.createRef();
    expect(() => $var('port', { default: 3000 })).not.toThrow();
  });

  it('throws when the same key registers a call-site default twice', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number' });
    const { $var } = vm.createRef();
    $var('port', { default: 3000 });
    expect(() => $var('port', { default: 8080 })).toThrow(/[Dd]uplicate/);
  });

  it('does not throw when no default option is provided', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number' });
    const { $var } = vm.createRef();
    expect(() => $var('port')).not.toThrow();
    expect(() => $var('port')).not.toThrow(); // calling without default multiple times is fine
  });
});

// ---------------------------------------------------------------------------
// $spread
// ---------------------------------------------------------------------------

describe('$spread()', () => {
  it('returns { key: "__synthing_spread", value: "$${{...key}}" }', () => {
    const vm = new VariableManager().addVariable('extra_env', { type: 'object' });
    const { $spread } = vm.createRef();
    const result = $spread('extra_env');
    expect(result).toEqual({
      key: '__synthing_spread',
      value: '$${{...extra_env}}',
    });
  });

  it('throws for an unknown key', () => {
    const vm = new VariableManager().addVariable('extra_env', { type: 'object' });
    const { $spread } = vm.createRef();
    expect(() => $spread('no_such_key' as never)).toThrow(/[Uu]nknown/);
  });
});

// ---------------------------------------------------------------------------
// toJSON()
// ---------------------------------------------------------------------------

describe('toJSON()', () => {
  it('returns all declared variables', () => {
    const vm = new VariableManager()
      .addVariable('app_name', { type: 'string' })
      .addVariable('port', { type: 'number', default: 3000 });

    const json = vm.toJSON();
    expect(json.variables).toHaveLength(2);
  });

  it('includes key, type, secret for each variable', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number', default: 3000 });
    const json = vm.toJSON();
    const entry = json.variables[0];
    expect(entry.key).toBe('port');
    expect(entry.type).toBe('number');
    expect(entry.secret).toBe(false);
    expect(entry.default).toBe(3000);
  });

  it('includes description when provided', () => {
    const vm = new VariableManager().addVariable('port', {
      type: 'number',
      description: 'HTTP port',
    });
    const json = vm.toJSON();
    expect(json.variables[0].description).toBe('HTTP port');
  });

  it('redacts default for secret variables', () => {
    const vm = new VariableManager().addVariable('db_password', {
      type: 'string',
      secret: true,
      default: 'supersecret',
    });

    const json = vm.toJSON();
    const entry = json.variables[0];
    expect(entry.secret).toBe(true);
    expect(entry.default).toBe('[REDACTED]');
  });

  it('does not include default when none was set', () => {
    const vm = new VariableManager().addVariable('port', { type: 'number' });
    const json = vm.toJSON();
    expect(json.variables[0].default).toBeUndefined();
  });

  it('does not expose connector configuration', () => {
    class MockConnector {
      async load(_keys: string[]) {}
      get(_key: string): unknown {
        return undefined;
      }
    }

    const vm = new VariableManager()
      .addVariable('port', { type: 'number' })
      .addConnector('env', new MockConnector() as never);

    const json = vm.toJSON();
    expect((json as unknown as Record<string, unknown>)['connectors']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Connector registration order
// ---------------------------------------------------------------------------

describe('addConnector()', () => {
  it('registers connectors in priority order', () => {
    class MockConnector {
      constructor(public readonly id: string) {}
      async load(_keys: string[]) {}
      get(_key: string): unknown {
        return undefined;
      }
    }

    const vm = new VariableManager()
      .addVariable('port', { type: 'number' })
      .addConnector('first', new MockConnector('first') as never)
      .addConnector('second', new MockConnector('second') as never);

    const connectors = vm.getConnectors();
    expect(connectors).toHaveLength(2);
    expect(connectors[0].name).toBe('first');
    expect(connectors[1].name).toBe('second');
  });
});
