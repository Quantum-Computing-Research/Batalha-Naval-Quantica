terraform {
  backend "remote" {
    organization = "QLAB"

    workspaces {
      name = "bnq"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}