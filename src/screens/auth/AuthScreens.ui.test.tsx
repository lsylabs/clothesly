import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn()
    }
  }
}));

const { supabase } = jest.requireMock('../../services/supabase') as {
  supabase: {
    auth: {
      signInWithPassword: jest.Mock;
      signUp: jest.Mock;
      signInWithOAuth: jest.Mock;
      exchangeCodeForSession: jest.Mock;
    };
  };
};

const SignInScreen = require('./SignInScreen').default;
const SignUpScreen = require('./SignUpScreen').default;

describe('Auth screen integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation alert when sign-in fields are missing', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const navigation = { navigate: jest.fn() } as any;
    const { getByText } = render(<SignInScreen navigation={navigation} route={{ key: 'SignIn', name: 'SignIn' } as any} />);

    fireEvent.press(getByText('Sign In'));

    expect(alertSpy).toHaveBeenCalledWith('Missing details', 'Please enter both email and password.');
  });

  it('submits sign-in credentials and surfaces backend auth error', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    const navigation = { navigate: jest.fn() } as any;
    const { getByPlaceholderText, getByText } = render(
      <SignInScreen navigation={navigation} route={{ key: 'SignIn', name: 'SignIn' } as any} />
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'bad-password');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'bad-password' });
      expect(alertSpy).toHaveBeenCalledWith('Sign in failed', 'Invalid login credentials');
    });
  });

  it('validates sign-up password mismatch before network call', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const navigation = { navigate: jest.fn() } as any;
    const { getByPlaceholderText, getByText } = render(
      <SignUpScreen navigation={navigation} route={{ key: 'SignUp', name: 'SignUp' } as any} />
    );

    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'different123');
    fireEvent.press(getByText('Create account'));

    expect(supabase.auth.signUp).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Password mismatch', 'Password and confirm password must match.');
  });
});
