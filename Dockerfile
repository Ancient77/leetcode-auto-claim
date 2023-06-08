FROM node:16-alpine

RUN apk update

WORKDIR /app

COPY . .
RUN apk add --no-cache git
RUN git clone https://github.com/billchen2k/leetcode-cli
RUN ls && chmod +x ./leetcode-cli/bin/install && leetcode-cli/bin/install 

RUN npm install
RUN npm run build

EXPOSE 7777

CMD [ "node", "./dist/main.js" ]