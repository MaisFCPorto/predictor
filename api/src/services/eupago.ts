import { Env } from '../../src/types';

type EuPagoMultibancoRequest = {
  payment: {
    amount: number;
    currency: 'EUR';
    expiryDays?: number;
  };
  customer: {
    name: string;
    email: string;
  };
};

type EuPagoMBWayRequest = {
  payment: {
    amount: number;
    currency: 'EUR';
    expiry?: number; // minutes
  };
  customer: {
    name: string;
    email: string;
    phone: string;
  };
};

type EuPagoMultibancoResponse = {
  success: boolean;
  message: string;
  id: string;
  status: string;
  payment: {
    type: 'multibanco';
    entity: string;
    reference: string;
    value: number;
    commission: number;
    currency: string;
    expiryDate: string;
  };
};

type EuPagoMBWayResponse = {
  success: boolean;
  message: string;
  id: string;
  status: string;
  payment: {
    type: 'mbway';
    reference: string;
    value: number;
    commission: number;
    currency: string;
    expiryDate: string;
  };
};

type EuPagoPaymentStatus = {
  success: boolean;
  message: string;
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  payment: {
    type: string;
    value: number;
    currency: string;
    paidDate?: string;
  };
};

export class EuPagoService {
  private apiKey: string;
  private baseUrl: string;

  constructor(env: Env) {
    this.apiKey = env.EUPAGO_API_KEY;
    this.baseUrl = env.EUPAGO_API_URL || 'https://sandbox.eupago.pt/api';
  }

  private async request<T>(endpoint: string, data: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `ApiKey ${this.apiKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`EuPago API error (${res.status}): ${error}`);
    }

    return res.json();
  }

  async createMultibanco(data: EuPagoMultibancoRequest): Promise<EuPagoMultibancoResponse> {
    return this.request<EuPagoMultibancoResponse>('/payments/multibanco', data);
  }

  async createMBWay(data: EuPagoMBWayRequest): Promise<EuPagoMBWayResponse> {
    return this.request<EuPagoMBWayResponse>('/payments/mbway', data);
  }

  async getPaymentStatus(paymentId: string): Promise<EuPagoPaymentStatus> {
    return this.request<EuPagoPaymentStatus>('/payments/status', { id: paymentId });
  }
}
