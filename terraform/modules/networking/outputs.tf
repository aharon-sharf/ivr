# Networking Module Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "nat_instance_id" {
  description = "NAT instance ID"
  value       = aws_instance.nat_instance.id
}

output "nat_instance_private_ip" {
  description = "NAT instance private IP"
  value       = aws_instance.nat_instance.private_ip
}

output "nat_instance_public_ip" {
  description = "NAT instance public IP"
  value       = aws_instance.nat_instance.public_ip
}

output "internet_gateway_id" {
  description = "Internet Gateway ID"
  value       = aws_internet_gateway.main.id
}
