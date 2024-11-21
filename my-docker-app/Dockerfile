# Base image
FROM ubuntu:latest

# Set environment variables to suppress interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update and install Node.js and npm
RUN apt-get update && apt-get install -y \
    curl \
    nodejs \
    npm && \
    apt-get clean

# Set the default command
CMD ["bash"]
