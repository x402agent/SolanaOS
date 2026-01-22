import {
  createPasskey,
  PasskeyStamper,
} from '@turnkey/react-native-passkey-stamper';
import {TurnkeyClient} from '@turnkey/http';
import {TURNKEY_BASE_URL, TURNKEY_RP_ID, TURNKEY_RP_NAME} from '@env';

export async function handleTurnkeyConnect(
  onWalletConnected?: (info: {provider: 'turnkey'; address: string}) => void,
  setStatusMessage?: (msg: string) => void,
) {
  setStatusMessage?.('Connecting with Turnkey...');
  try {
    const authenticatorParams = await createPasskey({
      authenticatorName: 'End-User Passkey',
      rp: {
        id: TURNKEY_RP_ID,
        name: TURNKEY_RP_NAME,
      },
      user: {
        id: String(Date.now()), // Unique user ID for demo
        name: 'Demo User',
        displayName: 'Demo User',
      },
    });
    console.log('Turnkey authenticator parameters:', authenticatorParams);

    const stamper = new PasskeyStamper({
      rpId: TURNKEY_RP_ID,
    });
    const turnkeyClient = new TurnkeyClient(
      {baseUrl: TURNKEY_BASE_URL},
      stamper,
    );

    setStatusMessage?.('Turnkey login flow initiated successfully.');

    onWalletConnected?.({
      provider: 'turnkey',
      address: String(Date.now()),
    });
  } catch (error: any) {
    console.error('Turnkey login error:', error);
    setStatusMessage?.(`Turnkey login failed: ${error.message}`);
    throw error;
  }
}
