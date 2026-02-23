FROM denoland/deno:2.2.2

WORKDIR /app

COPY deno.json .

COPY src/ ./src/

COPY assets/ ./assets/

RUN deno cache --allow-import src/main.ts

EXPOSE 3000

CMD ["deno", "run", "--allow-all", "--unstable-net", "src/main.ts"]
