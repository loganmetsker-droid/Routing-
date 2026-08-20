import { Global, Module } from '@nestjs/common';
import { AccessCodeCryptoService } from './access-code-crypto.service';

@Global()
@Module({
  providers: [AccessCodeCryptoService],
  exports: [AccessCodeCryptoService],
})
export class AccessCodeCryptoModule {}
