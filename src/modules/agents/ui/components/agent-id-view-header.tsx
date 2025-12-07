import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronRightIcon, MoreVerticalIcon, PencilIcon, TrashIcon } from "lucide-react";
import Link from "next/link";

interface Props {
    agentId: string;
    agentName: string;
    onEdit: () => void;
    onRemove: () => void;
}

export const AgentIdViewHeader = ({
    agentId,
    agentName,
    onEdit,
    onRemove
}: Props) => {
    return (
        <div className="flex items-center justify-between">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbList >
                            <BreadcrumbLink asChild className="font-medium text-xl">
                            <Link href="/agents">
                            My Agents 
                            </Link>
                            </BreadcrumbLink>
                        </BreadcrumbList>
                    </BreadcrumbItem>

                    <BreadcrumbSeparator className="text-foreground texxt-xl font-medium [&>svg]:size-4">
                        <ChevronRightIcon />
                    </BreadcrumbSeparator>

                    <BreadcrumbItem>
                        <BreadcrumbList >
                            <BreadcrumbLink asChild className="font-medium text-xl text-foreground">
                            <Link href={`/agents/${agentId}`}>
                                {agentName}
                            </Link>
                            </BreadcrumbLink>
                        </BreadcrumbList>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* without modal={false}, the dialog that this dropdown opens cause the website to get unclickable */}
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost">
                        <MoreVerticalIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                        <PencilIcon className="size-4 text-black" />
                        Edit
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={onRemove}>
                        <TrashIcon className="size-4 text-black" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}