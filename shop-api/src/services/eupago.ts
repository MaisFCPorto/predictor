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
  sucesso: boolean;
  estado: number;
  resposta: string;
  entidade: string;
  referencia: string;
  identificador: string; // TRID - Transaction ID
  valor: string;
  valor_minimo: string;
  valor_maximo: string;
  data_inicio: string;
  data_fim: string;
};

type EuPagoMBWayResponse = {
  sucesso: boolean;
  estado: number;
  resposta: string;
  referencia: string;
  identificador: string; // TRID - Transaction ID
  valor: string;
  alias: string;
};

type EuPagoPaymentStatus = {
  sucesso: boolean;
  estado: number;
  resposta: string;
  referencia: string;
  entidade: string;
  valor: string;
  estado_referencia: string; // "paga" or "por pagar"
  data_pagamento?: string;
};

export class EuPagoService {
  private apiKey: string;
  private baseUrl: string;

  constructor(env: Env) {
    this.apiKey = env.EUPAGO_API_KEY;
    this.baseUrl = env.EUPAGO_API_URL || 'https://sandbox.eupago.pt';
  }

  private async request<T>(endpoint: string, data: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log('EuPago API Request:', { url, data, apiKey: this.apiKey.substring(0, 10) + '...' });
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ApiKey': this.apiKey,
      },
      body: JSON.stringify(data),
    });

    const responseText = await res.text();
    console.log('EuPago API Response:', { status: res.status, body: responseText });

    if (!res.ok) {
      throw new Error(`EuPago API error (${res.status}): ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  async createMultibanco(data: EuPagoMultibancoRequest): Promise<EuPagoMultibancoResponse> {
    const requestBody: any = {
      chave: this.apiKey,
      valor: data.payment.amount.toFixed(2),
      id: crypto.randomUUID(),
      failOver: '0',
      email: data.customer.email,
    };

    // Add expiry date if specified (format: YYYY-MM-DD)
    if (data.payment.expiryDays) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + data.payment.expiryDays);
      const year = expiryDate.getFullYear();
      const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
      const day = String(expiryDate.getDate()).padStart(2, '0');
      requestBody.data_fim = `${year}-${month}-${day}`;
    }

    return this.request<EuPagoMultibancoResponse>('/clientes/rest_api/multibanco/create', requestBody);
  }

  async createMBWay(data: EuPagoMBWayRequest): Promise<EuPagoMBWayResponse> {
    const requestBody = {
      chave: this.apiKey,
      valor: data.payment.amount.toFixed(2),
      id: crypto.randomUUID(),
      alias: data.customer.phone,
      email: data.customer.email,
    };

    return this.request<EuPagoMBWayResponse>('/clientes/rest_api/mbway/create', requestBody);
  }

  async getPaymentStatus(reference: string): Promise<EuPagoPaymentStatus> {
    // Use the reference information endpoint to check payment status
    const requestBody = {
      chave: this.apiKey,
      referencia: reference,
    };
    
    return this.request<EuPagoPaymentStatus>('/clientes/rest_api/multibanco/info', requestBody);
  }

  async getPaymentStatusByTrid(trid: string): Promise<any> {
    // Use OAuth endpoint to check transaction status by TRID
    // Note: This requires OAuth authentication, not ApiKey
    const res = await fetch(`${this.baseUrl}/api/management/v1.02/payouts/transactions/${trid}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`, // May need OAuth token instead
      },
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`EuPago API error (${res.status}): ${error}`);
    }

    return res.json();
  }
}
