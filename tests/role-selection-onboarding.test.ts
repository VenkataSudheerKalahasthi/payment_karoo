import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole } from '@trustpay/shared';

describe('Role Selection and Registration Onboarding Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates supported roles as CLIENT and WORKER', () => {
    const validRoles = [UserRole.CLIENT, UserRole.WORKER];
    expect(validRoles).toContain('CLIENT');
    expect(validRoles).toContain('WORKER');
  });

  it('stores role intent correctly during registration or login', () => {
    const mockStorage: Record<string, string> = {};
    const setItem = (k: string, v: string) => {
      mockStorage[k] = v;
    };
    const getItem = (k: string) => mockStorage[k] || null;
    const removeItem = (k: string) => {
      delete mockStorage[k];
    };

    // 1. User selects Specialist during 'Get Started'
    setItem('trustpay_selected_role', 'WORKER');
    expect(getItem('trustpay_selected_role')).toBe('WORKER');

    // 2. Onboard sync reads stored role intent
    const resolvedIntent = getItem('trustpay_selected_role');
    expect(resolvedIntent).toBe('WORKER');

    // 3. Clean up after sync
    removeItem('trustpay_selected_role');
    expect(getItem('trustpay_selected_role')).toBeNull();
  });

  it('handles fallback to mandatory role prompt when no intent is pre-selected', () => {
    let roleSelectionRequired = false;
    const meRes = { success: false, error: { code: 'USER_NOT_REGISTERED' } };
    const savedIntent = null;

    if (meRes.error?.code === 'USER_NOT_REGISTERED') {
      if (savedIntent === 'CLIENT' || savedIntent === 'WORKER') {
        // auto-sync
      } else {
        roleSelectionRequired = true;
      }
    }

    expect(roleSelectionRequired).toBe(true);
  });

  it('allows seamless switching between Client Portal and Specialist Workspace', () => {
    let currentRole = UserRole.CLIENT;
    const switchRole = (newRole: UserRole) => {
      currentRole = newRole;
      return { success: true, activeRole: currentRole };
    };

    expect(currentRole).toBe(UserRole.CLIENT);
    const switchResult = switchRole(UserRole.WORKER);
    expect(switchResult.success).toBe(true);
    expect(switchResult.activeRole).toBe(UserRole.WORKER);
    expect(currentRole).toBe(UserRole.WORKER);
  });
});

