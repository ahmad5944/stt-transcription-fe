FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:5000
ARG VITE_STREAMING_WS_URL=ws://localhost:5003
ARG VITE_STREAMING_HTTP_URL=http://localhost:5003

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_STREAMING_WS_URL=${VITE_STREAMING_WS_URL}
ENV VITE_STREAMING_HTTP_URL=${VITE_STREAMING_HTTP_URL}

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
