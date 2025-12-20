"""Setup script for routing-dispatch-sdk"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="routing-dispatch-sdk",
    version="1.0.0",
    author="Routing & Dispatch Team",
    author_email="support@routingdispatch.com",
    description="Python SDK for the Routing & Dispatch SaaS API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-org/routing-dispatch-sdk-python",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.31.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-cov>=4.1.0",
            "black>=23.7.0",
            "flake8>=6.0.0",
            "mypy>=1.4.0",
        ],
    },
    keywords="routing dispatch logistics fleet api sdk",
    project_urls={
        "Bug Reports": "https://github.com/your-org/routing-dispatch-sdk-python/issues",
        "Source": "https://github.com/your-org/routing-dispatch-sdk-python",
        "Documentation": "https://docs.routingdispatch.com/python-sdk",
    },
)
