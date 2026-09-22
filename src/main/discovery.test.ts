import { describe, it, expect } from 'vitest';
import { calculateBroadcast } from './discovery';

describe('calculateBroadcast', () => {
  it('should calculate the correct broadcast address for a standard Class C subnet', () => {
    expect(calculateBroadcast('192.168.1.50', '255.255.255.0')).toBe('192.168.1.255');
  });

  it('should calculate the correct broadcast address for a /24 subnet', () => {
    expect(calculateBroadcast('10.0.0.15', '255.255.255.0')).toBe('10.0.0.255');
  });

  it('should calculate the correct broadcast address for a /16 subnet', () => {
    expect(calculateBroadcast('172.16.5.100', '255.255.0.0')).toBe('172.16.255.255');
  });

  it('should calculate the correct broadcast address for a /8 subnet', () => {
    expect(calculateBroadcast('10.5.6.7', '255.0.0.0')).toBe('10.255.255.255');
  });

  it('should handle subnets that do not end on byte boundaries', () => {
    // /23 subnet
    expect(calculateBroadcast('192.168.0.50', '255.255.254.0')).toBe('192.168.1.255');
    // /28 subnet
    expect(calculateBroadcast('192.168.1.130', '255.255.255.240')).toBe('192.168.1.143');
  });

  it('should return null if ip is invalid', () => {
    expect(calculateBroadcast('192.168.1', '255.255.255.0')).toBeNull(); // Missing part
    expect(calculateBroadcast('192.168.1.1.5', '255.255.255.0')).toBeNull(); // Extra part
    expect(calculateBroadcast('192.168.abc.1', '255.255.255.0')).toBeNull(); // Non-numeric
  });

  it('should return null if netmask is invalid', () => {
    expect(calculateBroadcast('192.168.1.1', '255.255.255')).toBeNull(); // Missing part
    expect(calculateBroadcast('192.168.1.1', '255.255.255.0.0')).toBeNull(); // Extra part
    expect(calculateBroadcast('192.168.1.1', '255.255.def.0')).toBeNull(); // Non-numeric
  });

  it('should return null for empty inputs', () => {
    expect(calculateBroadcast('', '255.255.255.0')).toBeNull();
    expect(calculateBroadcast('192.168.1.1', '')).toBeNull();
    expect(calculateBroadcast('', '')).toBeNull();
  });
});
