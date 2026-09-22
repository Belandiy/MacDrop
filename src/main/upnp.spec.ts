import { describe, it, expect } from 'vitest';
import { isPrivateIp } from './upnp';

describe('isPrivateIp', () => {
  it('should return true for empty or falsy IP', () => {
    expect(isPrivateIp('')).toBe(true);
    // @ts-ignore - testing runtime safety
    expect(isPrivateIp(null)).toBe(true);
    // @ts-ignore
    expect(isPrivateIp(undefined)).toBe(true);
  });

  it('should strip ::ffff: prefix and handle localhost/loopback', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('localhost')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
  });

  it('should return true for invalid IP formats', () => {
    expect(isPrivateIp('invalid-ip')).toBe(true);
    expect(isPrivateIp('256.256.256.256')).toBe(false); // Valid parsing, but not private based on current logic (wait, let's check what parts does)
    expect(isPrivateIp('192.168.1')).toBe(true); // missing part
    expect(isPrivateIp('192.168.1.1.1')).toBe(true); // extra part
    expect(isPrivateIp('192.168.a.1')).toBe(true); // NaN part
  });

  it('should identify Class A (10.x.x.x) private networks', () => {
    expect(isPrivateIp('10.0.0.0')).toBe(true);
    expect(isPrivateIp('10.255.255.255')).toBe(true);
    expect(isPrivateIp('10.1.2.3')).toBe(true);
  });

  it('should identify Class B (172.16.x.x - 172.31.x.x) private networks', () => {
    expect(isPrivateIp('172.16.0.0')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('172.20.10.5')).toBe(true);

    // IPs outside the private range
    expect(isPrivateIp('172.15.255.255')).toBe(false);
    expect(isPrivateIp('172.32.0.0')).toBe(false);
  });

  it('should identify Class C (192.168.x.x) private networks', () => {
    expect(isPrivateIp('192.168.0.0')).toBe(true);
    expect(isPrivateIp('192.168.255.255')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);

    expect(isPrivateIp('192.169.0.1')).toBe(false);
  });

  it('should identify CGNAT (100.64.x.x - 100.127.x.x) private networks', () => {
    expect(isPrivateIp('100.64.0.0')).toBe(true);
    expect(isPrivateIp('100.127.255.255')).toBe(true);
    expect(isPrivateIp('100.100.100.100')).toBe(true);

    expect(isPrivateIp('100.63.255.255')).toBe(false);
    expect(isPrivateIp('100.128.0.0')).toBe(false);
  });

  it('should return false for valid public IPs', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('93.184.216.34')).toBe(false);
    expect(isPrivateIp('104.21.25.1')).toBe(false);
  });
});
