FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY blockchain/package.json blockchain/package.json
RUN npm ci --workspace blockchain --include-workspace-root
COPY blockchain blockchain
RUN mkdir -p /app/.data/blockchain && chown -R node:node /app/.data /app/blockchain
USER node
EXPOSE 8545
HEALTHCHECK --interval=10s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})}).then(async r=>process.exit((await r.json()).result==='0x7a69'?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0", "--config", "blockchain/hardhat.config.ts"]
