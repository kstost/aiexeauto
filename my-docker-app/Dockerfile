# Base image
FROM ubuntu:latest

# Set environment variables to suppress interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update and install packages
RUN apt-get update && apt-get install -y \
    imagemagick \
    nodejs \
    npm \
    curl \
    wget \
    git \
    unzip \
    cmake \
    sudo \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    python3-full
    # apt-get clean && \
    # rm -rf /var/lib/apt/lists/*

# Create symbolic link for python only (pip link already exists)
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip in virtual environment
RUN pip install --upgrade pip

# Install Python packages
RUN pip install \
    pillow \
    moviepy \
    scikit-image \
    scikit-learn \
    openpyxl \
    xlrd \
    xlwt \
    PyMuPDF \
    pandas \
    matplotlib \
    scipy \
    opencv-python \
    numpy \
    requests

# Set UTF-8 locale for compatibility
# RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Set default command
CMD ["bash"]
