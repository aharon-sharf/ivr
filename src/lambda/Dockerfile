FROM public.ecr.aws/lambda/nodejs:18

# Install ffmpeg
RUN yum update -y && \
    yum install -y wget tar xz && \
    wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar -xf ffmpeg-release-amd64-static.tar.xz && \
    mv ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ && \
    rm -rf ffmpeg-* && \
    yum clean all

COPY package*.json ./
RUN npm ci --only=production

COPY audio-converter.js ./

CMD ["audio-converter.handler"]
