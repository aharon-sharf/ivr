FROM public.ecr.aws/lambda/nodejs:18

# Install ffmpeg
RUN yum update -y && \
    yum install -y wget tar xz && \
    wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar -xf ffmpeg-release-amd64-static.tar.xz && \
    mv ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ && \
    rm -rf ffmpeg-* && \
    yum clean all

COPY src/lambda/audio-converter/package*.json ./
RUN npm install

COPY src/lambda/audio-converter/audio-converter.ts ./
RUN npx typescript audio-converter.ts --target es2020 --module commonjs

# Remove dev dependencies to reduce image size
RUN npm prune --production

CMD ["audio-converter.handler"]
