terraform {
  backend "remote" {
    organization = "Graduate-APPs-USP"

    workspaces {
      name = "Battleship"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}