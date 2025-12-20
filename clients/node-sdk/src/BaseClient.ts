/**
 * Base client with common HTTP functionality
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  RoutingDispatchError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from './errors';
import { SDKConfig, ErrorResponse } from './types';

export class BaseClient {
  protected axiosInstance: AxiosInstance;

  constructor(config: SDKConfig) {
    const baseURL = config.baseURL || 'http://localhost:3000/api';
    const timeout = config.timeout || 30000;

    this.axiosInstance = axios.create({
      baseURL,
      timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'routing-dispatch-node-sdk/1.0.0',
      },
    });

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          const errorData = data as ErrorResponse;

          switch (status) {
            case 401:
              throw new AuthenticationError('Invalid API key');

            case 400:
              throw new ValidationError(
                errorData.message || 'Validation failed',
                errorData.errors
              );

            case 404:
              throw new NotFoundError(errorData.message || 'Not found');

            case 429:
              const retryAfter = error.response.headers['retry-after'];
              throw new RateLimitError(
                'Rate limit exceeded',
                retryAfter ? parseInt(retryAfter, 10) : undefined
              );

            default:
              throw new RoutingDispatchError(
                errorData.message || 'API error',
                status
              );
          }
        } else if (error.request) {
          throw new RoutingDispatchError('Network error: No response received');
        } else {
          throw new RoutingDispatchError(`Request error: ${error.message}`);
        }
      }
    );
  }

  protected async get<T>(endpoint: string, params?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.get(endpoint, {
      params,
    });
    return response.data;
  }

  protected async post<T>(endpoint: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.post(
      endpoint,
      data
    );
    return response.data;
  }

  protected async put<T>(endpoint: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.put(
      endpoint,
      data
    );
    return response.data;
  }

  protected async delete<T>(endpoint: string): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.delete(endpoint);
    return response.data;
  }
}
